"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  HelpCircle,
  Loader2,
  MessageCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface PaymentErrorData {
  appointment: {
    id: string;
    scheduledAt: string;
    type: string;
    doctor: {
      name: string;
      specialty: string;
    };
  };
  error: {
    code: string;
    message: string;
    provider: string;
    retryable: boolean;
    suggestedActions: string[];
  };
}

export default function PaymentCancelledPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<PaymentErrorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const appointmentId = searchParams.get("appointment_id");
  const provider = searchParams.get("provider");

  useEffect(() => {
    const fetchErrorData = async () => {
      try {
        if (appointmentId) {
          const response = await fetch(
            `/api/payments/error?appointment_id=${appointmentId}&error=${error}&provider=${provider}`
          );

          if (response.ok) {
            const result = await response.json();
            setData(result);
          }
        }
      } catch (error) {
        console.error("Error fetching error data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchErrorData();
  }, [appointmentId, error, provider]);

  const getErrorIcon = () => {
    if (error === "cancelled" || error === "user_cancelled") {
      return <XCircle className="h-10 w-10 text-orange-600" />;
    }
    return <AlertTriangle className="h-10 w-10 text-red-600" />;
  };

  const getErrorTitle = () => {
    if (error === "cancelled" || error === "user_cancelled") {
      return "Pago cancelado";
    }
    return "Error en el pago";
  };

  const getErrorMessage = () => {
    if (data?.error?.message) {
      return data.error.message;
    }

    if (errorDescription) {
      return errorDescription;
    }

    switch (error) {
      case "cancelled":
      case "user_cancelled":
        return "Has cancelado el proceso de pago. Tu cita no ha sido confirmada.";
      case "payment_failed":
        return "No se pudo procesar tu pago. Por favor, verifica tus datos e intenta nuevamente.";
      case "insufficient_funds":
        return "Fondos insuficientes. Por favor, verifica tu saldo o usa otro método de pago.";
      case "card_declined":
        return "Tu tarjeta fue rechazada. Por favor, contacta a tu banco o usa otro método de pago.";
      case "expired_card":
        return "Tu tarjeta ha expirado. Por favor, usa una tarjeta válida.";
      case "network_error":
        return "Error de conexión. Por favor, verifica tu internet e intenta nuevamente.";
      default:
        return "Ocurrió un error inesperado durante el proceso de pago.";
    }
  };

  const getErrorColor = () => {
    if (error === "cancelled" || error === "user_cancelled") {
      return "from-orange-50 to-yellow-50";
    }
    return "from-red-50 to-pink-50";
  };

  const retryPayment = async () => {
    if (!appointmentId) {
      router.push("/");
      return;
    }

    setRetrying(true);

    try {
      // Redirect back to payment selection for this appointment
      router.push(`/pago/seleccionar?appointment_id=${appointmentId}`);
    } catch (error) {
      console.error("Error retrying payment:", error);
      setRetrying(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  const goHome = () => {
    router.push("/");
  };

  const contactSupport = () => {
    router.push("/contacto?subject=problema-pago");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-600" />
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${getErrorColor()} p-4`}>
      <div className="max-w-2xl mx-auto py-8">
        {/* Error Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            {getErrorIcon()}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getErrorTitle()}
          </h1>
          <p className="text-lg text-gray-600">{getErrorMessage()}</p>
        </div>

        {/* Error Details */}
        {data && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span>Detalles del error</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Código de error:</span>
                <Badge variant="destructive" className="font-mono">
                  {data.error.code}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Proveedor de pago:</span>
                <Badge variant="outline" className="capitalize">
                  {data.error.provider}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">¿Se puede reintentar?</span>
                <Badge variant={data.error.retryable ? "default" : "secondary"}>
                  {data.error.retryable ? "Sí" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointment Info */}
        {data?.appointment && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Cita pendiente de pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  <strong>Doctor:</strong> Dr. {data.appointment.doctor.name}
                </p>
                <p>
                  <strong>Especialidad:</strong>{" "}
                  {data.appointment.doctor.specialty}
                </p>
                <p>
                  <strong>Fecha:</strong>{" "}
                  {new Date(data.appointment.scheduledAt).toLocaleDateString(
                    "es-MX",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suggested Actions */}
        {data?.error?.suggestedActions &&
          data.error.suggestedActions.length > 0 && (
            <Alert className="mb-6">
              <HelpCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Acciones sugeridas:</strong>
                <ul className="mt-2 space-y-1">
                  {data.error.suggestedActions.map((action, index) => (
                    <li key={index} className="text-sm">
                      • {action}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Primary Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.error?.retryable !== false && (
              <Button
                onClick={retryPayment}
                disabled={retrying}
                className="flex items-center justify-center space-x-2"
              >
                {retrying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Redirigiendo...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Intentar nuevamente</span>
                  </>
                )}
              </Button>
            )}

            <Button
              onClick={contactSupport}
              variant="outline"
              className="flex items-center justify-center space-x-2"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Contactar soporte</span>
            </Button>
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={goBack}
              variant="ghost"
              className="flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver atrás</span>
            </Button>

            <Button
              onClick={goHome}
              variant="ghost"
              className="flex items-center justify-center space-x-2"
            >
              <span>Ir al inicio</span>
            </Button>
          </div>
        </div>

        {/* Help Information */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="font-medium text-blue-900 mb-2">
                ¿Necesitas ayuda?
              </h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• Verifica que tu tarjeta tenga fondos suficientes</p>
                <p>• Asegúrate de que tu tarjeta no haya expirado</p>
                <p>• Contacta a tu banco si el problema persiste</p>
                <p>• Puedes intentar con otro método de pago</p>
                <p>• Si el problema continúa, contacta nuestro soporte</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
