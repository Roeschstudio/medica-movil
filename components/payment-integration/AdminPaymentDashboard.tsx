"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePaymentAnalytics } from "@/hooks/use-payment-integration";
import { useUnifiedAdminMonitoring } from "@/lib/unified-realtime-context";
import { formatCurrency } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

export function AdminPaymentDashboard() {
  const { analytics, isLoading, error, refresh } = usePaymentAnalytics();
  const { paymentActivity } = useUnifiedAdminMonitoring();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              <div className="h-4 w-4 animate-pulse bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded mb-2" />
              <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  const failureRate = analytics.failureRate || 0;
  const isHighFailureRate = failureRate > 10;

  return (
    <div className="space-y-6">
      {/* Revenue Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.daily.revenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.daily.count} payments today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Weekly Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.weekly.revenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.weekly.count} payments this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.monthly.revenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.monthly.count} payments this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failure Rate</CardTitle>
            {isHighFailureRate ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                isHighFailureRate ? "text-destructive" : "text-green-600"
              }`}
            >
              {failureRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {isHighFailureRate ? "Above threshold" : "Within normal range"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Providers</CardTitle>
          <CardDescription>
            Revenue breakdown by payment provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.providers.map((provider: any) => (
              <div
                key={provider.provider}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium capitalize">
                      {provider.provider}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {provider.count} payments
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {formatCurrency(provider.revenue)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(
                      (provider.revenue / analytics.monthly.revenue) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Latest payment transactions</CardDescription>
          </div>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.recentPayments.map((payment: any) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      payment.status === "COMPLETED"
                        ? "bg-green-100"
                        : payment.status === "FAILED"
                        ? "bg-red-100"
                        : "bg-yellow-100"
                    }`}
                  >
                    {payment.status === "COMPLETED" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : payment.status === "FAILED" ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {payment.patientName} → {payment.doctorName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(payment.amount)} via {payment.provider}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      payment.status === "COMPLETED"
                        ? "default"
                        : payment.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {payment.status}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(payment.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity */}
      {paymentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Real-time Payment Activity</CardTitle>
            <CardDescription>Live payment events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paymentActivity
                .slice(0, 5)
                .map((activity: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </span>
                    <span>{activity.message}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
