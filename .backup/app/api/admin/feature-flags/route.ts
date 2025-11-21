import { authOptions } from "@/lib/unified-auth";
import { FeatureFlags } from "@/lib/payments/features/FeatureFlags";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Check if user is admin
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "status":
        return NextResponse.json({
          status: FeatureFlags.getFeatureFlagStatus(),
          providerAvailability: FeatureFlags.monitorProviderAvailability(),
          timestamp: new Date().toISOString(),
        });

      case "list":
        return NextResponse.json({
          flags: FeatureFlags.getAllFlags(),
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({
          flags: FeatureFlags.getAllFlags(),
          status: FeatureFlags.getFeatureFlagStatus(),
          providerAvailability: FeatureFlags.monitorProviderAvailability(),
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error("Feature flags API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, flagName, data } = body;

    switch (action) {
      case "toggle":
        const toggleResult = FeatureFlags.toggleFlag(flagName, data.enabled);
        if (!toggleResult) {
          return NextResponse.json(
            { error: "Feature flag not found" },
            { status: 404 }
          );
        }

        // Log the change
        await logFeatureFlagChange(session.user.id, flagName, "toggle", {
          enabled: data.enabled,
        });

        return NextResponse.json({
          success: true,
          flag: FeatureFlags.getFlag(flagName),
        });

      case "update_rollout":
        try {
          const updateResult = FeatureFlags.updateRolloutPercentage(
            flagName,
            data.percentage
          );
          if (!updateResult) {
            return NextResponse.json(
              { error: "Feature flag not found" },
              { status: 404 }
            );
          }

          await logFeatureFlagChange(
            session.user.id,
            flagName,
            "rollout_update",
            { percentage: data.percentage }
          );

          return NextResponse.json({
            success: true,
            flag: FeatureFlags.getFlag(flagName),
          });
        } catch (error) {
          return NextResponse.json(
            {
              error:
                error instanceof Error ? error.message : "Invalid percentage",
            },
            { status: 400 }
          );
        }

      case "gradual_rollout":
        try {
          // Start gradual rollout in background
          FeatureFlags.gradualRollout(
            flagName,
            data.targetPercentage,
            data.incrementPercentage || 10,
            data.intervalMs || 60000
          )
            .then(() => {
              console.log(`Gradual rollout completed for ${flagName}`);
            })
            .catch((error) => {
              console.error(`Gradual rollout failed for ${flagName}:`, error);
            });

          await logFeatureFlagChange(
            session.user.id,
            flagName,
            "gradual_rollout_start",
            data
          );

          return NextResponse.json({
            success: true,
            message: "Gradual rollout started",
            flag: FeatureFlags.getFlag(flagName),
          });
        } catch (error) {
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Gradual rollout failed",
            },
            { status: 400 }
          );
        }

      case "emergency_rollback":
        const rollbackResult = FeatureFlags.emergencyRollback(
          flagName,
          data.reason
        );
        if (!rollbackResult) {
          return NextResponse.json(
            { error: "Feature flag not found" },
            { status: 404 }
          );
        }

        await logFeatureFlagChange(
          session.user.id,
          flagName,
          "emergency_rollback",
          { reason: data.reason }
        );

        return NextResponse.json({
          success: true,
          message: "Emergency rollback completed",
          flag: FeatureFlags.getFlag(flagName),
        });

      case "provider_rollback":
        const { provider, operation } = data;
        const rollbackProcedure =
          FeatureFlags.createProviderRollbackProcedure(provider);

        let result;
        switch (operation) {
          case "disable":
            result = rollbackProcedure.disable();
            break;
          case "enable":
            result = rollbackProcedure.enable();
            break;
          case "emergency_disable":
            result = rollbackProcedure.emergencyDisable(
              data.reason || "Admin action"
            );
            break;
          default:
            return NextResponse.json(
              { error: "Invalid operation" },
              { status: 400 }
            );
        }

        await logFeatureFlagChange(
          session.user.id,
          `payment_provider_${provider}`,
          operation,
          data
        );

        return NextResponse.json({
          success: true,
          message: `Provider ${provider} ${operation} completed`,
          providerAvailability: FeatureFlags.monitorProviderAvailability(),
        });

      case "create_flag":
        FeatureFlags.setFlag(flagName, {
          name: flagName,
          enabled: data.enabled || false,
          rolloutPercentage: data.rolloutPercentage || 0,
          conditions: data.conditions || [],
          metadata: data.metadata || {},
        });

        await logFeatureFlagChange(session.user.id, flagName, "create", data);

        return NextResponse.json({
          success: true,
          flag: FeatureFlags.getFlag(flagName),
        });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Feature flags action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function logFeatureFlagChange(
  userId: string,
  flagName: string,
  action: string,
  data: any
): Promise<void> {
  try {
    await prisma.adminNotification.create({
      data: {
        type: "FEATURE_FLAG_CHANGE",
        title: `Feature Flag ${action.toUpperCase()}`,
        message: `Feature flag '${flagName}' was ${action} by admin`,
        severity: action.includes("emergency") ? "HIGH" : "MEDIUM",
        data: {
          flagName,
          action,
          userId,
          timestamp: new Date().toISOString(),
          ...data,
        } as any,
        read: false,
      },
    });
  } catch (error) {
    console.error("Failed to log feature flag change:", error);
  }
}
