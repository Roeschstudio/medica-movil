import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  notificationIds: z
    .array(z.string().cuid("Invalid notification ID format"))
    .min(1, "At least one notification ID required"),
  isRead: z.boolean(),
});

const bulkDeleteSchema = z.object({
  notificationIds: z
    .array(z.string().cuid("Invalid notification ID format"))
    .min(1, "At least one notification ID required"),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = bulkUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { notificationIds, isRead } = validationResult.data;

    // Verify all notifications exist and belong to user
    const existingNotifications = await prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (existingNotifications.length !== notificationIds.length) {
      return NextResponse.json(
        { error: "One or more notifications not found or access denied" },
        { status: 404 }
      );
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId: session.user.id,
      },
      data: { isRead },
    });

    return NextResponse.json({
      message: `${result.count} notifications updated successfully`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error bulk updating notifications:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = bulkDeleteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { notificationIds } = validationResult.data;

    // Verify all notifications exist and belong to user
    const existingNotifications = await prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (existingNotifications.length !== notificationIds.length) {
      return NextResponse.json(
        { error: "One or more notifications not found or access denied" },
        { status: 404 }
      );
    }

    const result = await prisma.notification.deleteMany({
      where: {
        id: { in: notificationIds },
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      message: `${result.count} notifications deleted successfully`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error bulk deleting notifications:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
