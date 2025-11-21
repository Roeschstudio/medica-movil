import { prisma } from "@/lib/db";
import { PaymentService } from "./PaymentService";
import { PaymentProviderType } from "./types";

export class PaymentMonitoring {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Check and update status for all pending payments
   */
  async updatePendingPayments(): Promise<{
    checked: number;
    updated: number;
    errors: number;
  }> {
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: "PENDING",
        createdAt: {
          // Only check payments created in the last 24 hours
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      include: {
        appointment: true,
      },
    });

    let checked = 0;
    let updated = 0;
    let errors = 0;

    for (const payment of pendingPayments) {
      try {
        checked++;
        const provider = payment.paymentMethod as PaymentProviderType;
        let providerPaymentId: string | null = null;

        // Get provider-specific payment ID
        switch (provider) {
          case "stripe":
            providerPaymentId =
              payment.stripePaymentId || payment.stripeSessionId;
            break;
          case "paypal":
            providerPaymentId =
              payment.paypalOrderId || payment.paypalPaymentId;
            break;
          case "mercadopago":
            providerPaymentId = payment.mercadopagoId;
            break;
        }

        if (!providerPaymentId) {
          console.warn(
            `No provider payment ID found for payment ${payment.id}`
          );
          continue;
        }

        // Check status with provider
        const providerStatus = await this.paymentService.getPaymentStatus(
          provider,
          providerPaymentId
        );

        if (
          providerStatus &&
          providerStatus.status !== payment.status.toLowerCase()
        ) {
          // Update payment status
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: providerStatus.status.toUpperCase() as any,
              paidAt: providerStatus.paidAt || undefined,
              paymentData: providerStatus.metadata || undefined,
              updatedAt: new Date(),
            },
          });

          // Update appointment if payment completed
          if (providerStatus.status === "completed" && payment.appointmentId) {
            await prisma.appointment.update({
              where: { id: payment.appointmentId },
              data: { paymentStatus: "PAID" },
            });
          }

          updated++;
          console.log(
            `Updated payment ${payment.id} status to ${providerStatus.status}`
          );
        }
      } catch (error) {
        errors++;
        console.error(`Error checking payment ${payment.id}:`, error);
      }
    }

    return { checked, updated, errors };
  }

  /**
   * Check for payments that have timed out
   */
  async handleTimeoutPayments(): Promise<{
    timedOut: number;
    cancelled: number;
  }> {
    const timeoutThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

    const timedOutPayments = await prisma.payment.findMany({
      where: {
        status: "PENDING",
        createdAt: {
          lt: timeoutThreshold,
        },
      },
    });

    let cancelled = 0;

    for (const payment of timedOutPayments) {
      try {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "CANCELLED",
            failureReason: "Payment session timed out",
            updatedAt: new Date(),
          },
        });

        cancelled++;
        console.log(`Cancelled timed out payment ${payment.id}`);
      } catch (error) {
        console.error(`Error cancelling payment ${payment.id}:`, error);
      }
    }

    return {
      timedOut: timedOutPayments.length,
      cancelled,
    };
  }

  /**
   * Get payment statistics for monitoring
   */
  async getPaymentStats(hours: number = 24): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    cancelled: number;
    byProvider: Record<string, number>;
    successRate: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: since },
      },
    });

    const stats = {
      total: payments.length,
      completed: 0,
      pending: 0,
      failed: 0,
      cancelled: 0,
      byProvider: {} as Record<string, number>,
      successRate: 0,
    };

    for (const payment of payments) {
      // Count by status
      switch (payment.status) {
        case "COMPLETED":
          stats.completed++;
          break;
        case "PENDING":
          stats.pending++;
          break;
        case "FAILED":
          stats.failed++;
          break;
        case "CANCELLED":
          stats.cancelled++;
          break;
      }

      // Count by provider
      const provider = payment.paymentMethod || "unknown";
      stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1;
    }

    // Calculate success rate
    stats.successRate =
      stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    return stats;
  }

  /**
   * Reconcile payments with provider records
   */
  async reconcilePayments(
    provider: PaymentProviderType,
    hours: number = 24
  ): Promise<{
    reconciled: number;
    discrepancies: Array<{
      paymentId: string;
      databaseStatus: string;
      providerStatus: string;
    }>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const payments = await prisma.payment.findMany({
      where: {
        paymentMethod: provider,
        createdAt: { gte: since },
        status: { in: ["COMPLETED", "FAILED"] },
      },
    });

    let reconciled = 0;
    const discrepancies = [];

    for (const payment of payments) {
      try {
        let providerPaymentId: string | null = null;

        switch (provider) {
          case "stripe":
            providerPaymentId =
              payment.stripePaymentId || payment.stripeSessionId;
            break;
          case "paypal":
            providerPaymentId =
              payment.paypalOrderId || payment.paypalPaymentId;
            break;
          case "mercadopago":
            providerPaymentId = payment.mercadopagoId;
            break;
        }

        if (!providerPaymentId) continue;

        const providerStatus = await this.paymentService.getPaymentStatus(
          provider,
          providerPaymentId
        );

        if (providerStatus) {
          reconciled++;

          if (providerStatus.status !== payment.status.toLowerCase()) {
            discrepancies.push({
              paymentId: payment.id,
              databaseStatus: payment.status,
              providerStatus: providerStatus.status,
            });
          }
        }
      } catch (error) {
        console.error(`Error reconciling payment ${payment.id}:`, error);
      }
    }

    return { reconciled, discrepancies };
  }
}
