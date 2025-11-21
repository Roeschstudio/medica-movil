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
import { usePaymentStatus } from "@/hooks/use-payment-integration";
import { AlertCircle, CheckCircle, Clock, CreditCard } from "lucide-react";
import Link from "next/link";

interface PaymentStatusIndicatorProps {
  appointmentId?: string;
  chatRoomId?: string;
  sessionId?: string;
  variant?: "compact" | "detailed" | "inline";
  showActions?: boolean;
  className?: string;
}

export function PaymentStatusIndicator({
  appointmentId,
  chatRoomId,
  sessionId,
  variant = "compact",
  showActions = true,
  className = "",
}: PaymentStatusIndicatorProps) {
  const paymentStatus = usePaymentStatus({
    appointmentId,
    chatRoomId,
    sessionId,
  });

  if (paymentStatus.isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Clock className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          Checking payment...
        </span>
      </div>
    );
  }

  if (paymentStatus.overallStatus === "not_required") {
    return null;
  }

  const getStatusIcon = () => {
    switch (paymentStatus.overallStatus) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "required":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <CreditCard className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (paymentStatus.overallStatus) {
      case "paid":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Paid
          </Badge>
        );
      case "required":
        return <Badge variant="destructive">Payment Required</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getStatusMessage = () => {
    if (paymentStatus.isPaid) {
      return "Payment confirmed. All features are available.";
    }

    if (paymentStatus.requiresPayment) {
      return "Payment is required to access all features.";
    }

    return "Payment status unknown.";
  };

  const getPaymentUrl = () => {
    if (appointmentId) {
      return `/pago/${appointmentId}`;
    }

    if (paymentStatus.chat.appointmentId) {
      return `/pago/${paymentStatus.chat.appointmentId}`;
    }

    return "/paciente/payments";
  };

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        {getStatusBadge()}
        {showActions && paymentStatus.requiresPayment && (
          <Button asChild size="sm" variant="outline">
            <Link href={getPaymentUrl()}>Pay Now</Link>
          </Button>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`flex items-center justify-between p-3 border rounded-lg ${className}`}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {paymentStatus.isPaid ? "Payment Confirmed" : "Payment Required"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {showActions && paymentStatus.requiresPayment && (
            <Button asChild size="sm">
              <Link href={getPaymentUrl()}>Pay Now</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Detailed variant
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {getStatusIcon()}
            Payment Status
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-4">{getStatusMessage()}</CardDescription>

        {/* Payment Details */}
        {paymentStatus.appointment.paymentStatus && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">
                ${paymentStatus.appointment.paymentStatus.amount}{" "}
                {paymentStatus.appointment.paymentStatus.currency}
              </span>
            </div>
            {paymentStatus.appointment.paymentStatus.provider && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider:</span>
                <span className="font-medium capitalize">
                  {paymentStatus.appointment.paymentStatus.provider}
                </span>
              </div>
            )}
            {paymentStatus.appointment.paymentStatus.paidAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid At:</span>
                <span className="font-medium">
                  {new Date(
                    paymentStatus.appointment.paymentStatus.paidAt
                  ).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 mt-4">
            {paymentStatus.requiresPayment && (
              <Button asChild className="flex-1">
                <Link href={getPaymentUrl()}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Complete Payment
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={paymentStatus.refreshAll}
              className="flex-1"
            >
              Refresh Status
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Specialized components for different contexts

export function ChatPaymentIndicator({ chatRoomId }: { chatRoomId: string }) {
  return (
    <PaymentStatusIndicator
      chatRoomId={chatRoomId}
      variant="compact"
      className="mb-4"
    />
  );
}

export function VideoCallPaymentIndicator({
  appointmentId,
  sessionId,
}: {
  appointmentId?: string;
  sessionId?: string;
}) {
  return (
    <PaymentStatusIndicator
      appointmentId={appointmentId}
      sessionId={sessionId}
      variant="detailed"
      className="mb-4"
    />
  );
}

export function AppointmentPaymentIndicator({
  appointmentId,
}: {
  appointmentId: string;
}) {
  return (
    <PaymentStatusIndicator appointmentId={appointmentId} variant="detailed" />
  );
}
