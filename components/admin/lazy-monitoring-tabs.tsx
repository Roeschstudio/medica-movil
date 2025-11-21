"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { lazy, Suspense } from "react";

// Lazy load monitoring components for better performance
const ChatMonitoring = lazy(() =>
  import("./chat-monitoring").then((module) => ({
    default: module.ChatMonitoring,
  }))
);
const VideoCallAnalytics = lazy(() =>
  import("./video-call-analytics").then((module) => ({
    default: module.VideoCallAnalytics,
  }))
);
const PaymentDashboard = lazy(() =>
  import("./payment-dashboard").then((module) => ({
    default: module.PaymentDashboard,
  }))
);

// Loading skeleton for monitoring components
function MonitoringLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function LazyChatMonitoring() {
  return (
    <Suspense fallback={<MonitoringLoadingSkeleton />}>
      <ChatMonitoring />
    </Suspense>
  );
}

export function LazyVideoCallAnalytics() {
  return (
    <Suspense fallback={<MonitoringLoadingSkeleton />}>
      <VideoCallAnalytics />
    </Suspense>
  );
}

export function LazyPaymentDashboard() {
  return (
    <Suspense fallback={<MonitoringLoadingSkeleton />}>
      <PaymentDashboard />
    </Suspense>
  );
}
