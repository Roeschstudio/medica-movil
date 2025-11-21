"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";
import {
  formatDistanceToNow,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  AlertTriangle,
  Banknote,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface PaymentStats {
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  pendingPayments: number;
  completedPayments: number;
  failedPayments: number;
  refundedPayments: number;
  averageAmount: number;
  paymentMethodStats: {
    CARD: number;
    OXXO: number;
    SPEI: number;
    PAYPAL: number;
    MERCADOPAGO_CARD: number;
    MERCADOPAGO_INSTALLMENTS: number;
  };
  providerStats: {
    STRIPE: number;
    PAYPAL: number;
    MERCADOPAGO: number;
  };
}

interface Payment {
  id: string;
  userId: string;
  appointmentId?: string;
  amount: number;
  currency: string;
  method: string;
  provider: string;
  status:
    | "PENDING"
    | "COMPLETED"
    | "FAILED"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED";
  failureReason?: string;
  paidAt?: string;
  refundedAt?: string;
  createdAt: string;
  user: {
    name: string;
  };
  appointment?: {
    doctor: {
      user: {
        name: string;
      };
    };
    patient: {
      name: string;
    };
  };
}

interface PaymentDashboardState {
  stats: PaymentStats;
  recentPayments: Payment[];
  isLoading: boolean;
  error: string | null;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "PENDING":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "COMPLETED":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "FAILED":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    default:
      return <CreditCard className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const formatCurrency = (amount: number, currency: string = "MXN") => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency,
  }).format(amount / 100); // Assuming amounts are stored in cents
};

const getMethodDisplayName = (method: string) => {
  const methodNames: Record<string, string> = {
    CARD: "Tarjeta",
    OXXO: "OXXO",
    SPEI: "SPEI",
    PAYPAL: "PayPal",
    MERCADOPAGO_CARD: "MercadoPago Tarjeta",
    MERCADOPAGO_INSTALLMENTS: "MercadoPago Cuotas",
  };
  return methodNames[method] || method;
};

export function PaymentDashboard() {
  const [state, setState] = useState<PaymentDashboardState>({
    stats: {
      totalRevenue: 0,
      todayRevenue: 0,
      weekRevenue: 0,
      monthRevenue: 0,
      pendingPayments: 0,
      completedPayments: 0,
      failedPayments: 0,
      refundedPayments: 0,
      averageAmount: 0,
      paymentMethodStats: {
        CARD: 0,
        OXXO: 0,
        SPEI: 0,
        PAYPAL: 0,
        MERCADOPAGO_CARD: 0,
        MERCADOPAGO_INSTALLMENTS: 0,
      },
      providerStats: {
        STRIPE: 0,
        PAYPAL: 0,
        MERCADOPAGO: 0,
      },
    },
    recentPayments: [],
    isLoading: true,
    error: null,
  });

  // Using imported supabase client

  // Calculate payment statistics
  const calculateStats = useCallback(async () => {
    try {
      // Get all payments
      const { data: allPayments, error: paymentsError } = await supabase
        .from("payments")
        .select(
          "amount, currency, method, provider, status, createdAt, paidAt, refundedAt"
        );

      if (paymentsError) throw paymentsError;

      const payments = allPayments || [];
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);

      // Calculate revenue metrics
      const completedPayments = payments.filter(
        (p) => p.status === "COMPLETED"
      );
      const totalRevenue = completedPayments.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      const todayRevenue = completedPayments
        .filter((p) => p.paidAt && new Date(p.paidAt) >= todayStart)
        .reduce((sum, p) => sum + p.amount, 0);

      const weekRevenue = completedPayments
        .filter((p) => p.paidAt && new Date(p.paidAt) >= weekStart)
        .reduce((sum, p) => sum + p.amount, 0);

      const monthRevenue = completedPayments
        .filter((p) => p.paidAt && new Date(p.paidAt) >= monthStart)
        .reduce((sum, p) => sum + p.amount, 0);

      // Calculate status counts
      const pendingPayments = payments.filter(
        (p) => p.status === "PENDING"
      ).length;
      const completedCount = payments.filter(
        (p) => p.status === "COMPLETED"
      ).length;
      const failedPayments = payments.filter(
        (p) => p.status === "FAILED"
      ).length;
      const refundedPayments = payments.filter(
        (p) => p.status === "REFUNDED" || p.status === "PARTIALLY_REFUNDED"
      ).length;

      const averageAmount =
        completedCount > 0 ? totalRevenue / completedCount : 0;

      // Calculate payment method statistics
      const paymentMethodStats = {
        CARD: payments.filter((p) => p.method === "CARD").length,
        OXXO: payments.filter((p) => p.method === "OXXO").length,
        SPEI: payments.filter((p) => p.method === "SPEI").length,
        PAYPAL: payments.filter((p) => p.method === "PAYPAL").length,
        MERCADOPAGO_CARD: payments.filter(
          (p) => p.method === "MERCADOPAGO_CARD"
        ).length,
        MERCADOPAGO_INSTALLMENTS: payments.filter(
          (p) => p.method === "MERCADOPAGO_INSTALLMENTS"
        ).length,
      };

      // Calculate provider statistics
      const providerStats = {
        STRIPE: payments.filter((p) => p.provider === "STRIPE").length,
        PAYPAL: payments.filter((p) => p.provider === "PAYPAL").length,
        MERCADOPAGO: payments.filter((p) => p.provider === "MERCADOPAGO")
          .length,
      };

      return {
        totalRevenue,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        pendingPayments,
        completedPayments: completedCount,
        failedPayments,
        refundedPayments,
        averageAmount,
        paymentMethodStats,
        providerStats,
      };
    } catch (error) {
      console.error("Error calculating payment stats:", error);
      throw error;
    }
  }, [supabase]);

  // Load recent payments
  const loadRecentPayments = useCallback(async () => {
    try {
      const { data: payments, error } = await supabase
        .from("payments")
        .select(
          `
          id,
          userId,
          appointmentId,
          amount,
          currency,
          method,
          provider,
          status,
          failureReason,
          paidAt,
          refundedAt,
          createdAt,
          user:users(name),
          appointment:appointments(
            doctor:doctors(
              user:users(name)
            ),
            patient:users!appointments_patientId_fkey(name)
          )
        `
        )
        .order("createdAt", { ascending: false })
        .limit(20);

      if (error) throw error;

      return payments || [];
    } catch (error) {
      console.error("Error loading recent payments:", error);
      throw error;
    }
  }, [supabase]);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const [stats, recentPayments] = await Promise.all([
        calculateStats(),
        loadRecentPayments(),
      ]);

      setState((prev) => ({
        ...prev,
        stats,
        recentPayments,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error loading payment data:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load payment data",
        isLoading: false,
      }));
    }
  }, [calculateStats, loadRecentPayments]);

  // Set up real-time subscriptions
  useEffect(() => {
    loadData();

    // Subscribe to payment changes
    const paymentChannel = supabase
      .channel("admin-payment-dashboard")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      paymentChannel.unsubscribe();
    };
  }, [supabase, loadData]);

  const { stats, recentPayments, isLoading, error } = state;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.todayRevenue)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.weekRevenue)}
                </p>
              </div>
              <Banknote className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.monthRevenue)}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.completedPayments}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    stats.pendingPayments > 5
                      ? "text-yellow-600"
                      : "text-gray-900"
                  )}
                >
                  {stats.pendingPayments}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
            {stats.pendingPayments > 5 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                <AlertTriangle className="h-3 w-3" />
                <span>High pending count</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    stats.failedPayments > 10 ? "text-red-600" : "text-gray-900"
                  )}
                >
                  {stats.failedPayments}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            {stats.failedPayments > 10 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>High failure rate</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Amount
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.averageAmount)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.paymentMethodStats).map(
                ([method, count]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">
                      {getMethodDisplayName(method)}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${
                              stats.completedPayments > 0
                                ? (count / stats.completedPayments) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent payments</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {recentPayments.map((payment) => (
                    <div key={payment.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(payment.status)}
                          <Badge className={getStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </div>
                        <span className="font-bold text-green-600">
                          {formatCurrency(payment.amount, payment.currency)}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {payment.user.name}
                          </span>
                          <span className="text-gray-500">
                            {getMethodDisplayName(payment.method)}
                          </span>
                        </div>

                        {payment.appointment && (
                          <div className="text-xs text-gray-500">
                            Appointment: Dr.{" "}
                            {payment.appointment.doctor.user.name} &{" "}
                            {payment.appointment.patient.name}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Provider: {payment.provider}</span>
                          <span>
                            {formatDistanceToNow(new Date(payment.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>

                        {payment.failureReason && (
                          <div className="text-xs text-red-600 mt-1">
                            <AlertTriangle className="h-3 w-3 inline mr-1" />
                            {payment.failureReason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
