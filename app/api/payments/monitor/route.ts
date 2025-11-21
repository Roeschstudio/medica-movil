import { PaymentMonitoring } from "@/lib/payments/monitoring";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a trusted source (cron job)
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET || "default-secret";

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monitoring = new PaymentMonitoring();

    // Update pending payments
    const updateResult = await monitoring.updatePendingPayments();

    // Handle timeout payments
    const timeoutResult = await monitoring.handleTimeoutPayments();

    // Get current stats
    const stats = await monitoring.getPaymentStats(24);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        pendingPayments: updateResult,
        timeoutPayments: timeoutResult,
        stats,
      },
    });
  } catch (error) {
    console.error("Payment monitoring error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Simple health check and stats endpoint
    const monitoring = new PaymentMonitoring();
    const stats = await monitoring.getPaymentStats(24);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    console.error("Payment monitoring stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
