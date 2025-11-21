"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  formatMexicanCurrency,
  formatMexicanTime,
  translateConsultationType,
} from "@/lib/mexican-utils";
import { ConsultationType } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  CheckCircle,
  Clock,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  Stethoscope,
  User,
  Video,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface PaymentSuccessData {
  appointment: {
    id: string;
    scheduledAt: string;
    type: ConsultationType;
    notes?: string;
    doctor: {
      name: string;
      specialty: string;
      city: string;
      state: string;
      profileImage?: string;
    };
  };
  payment: {
    id: string;
    amount: number;
    currency: string;
    provider: string;
    paidAt: string;
  };
}

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<PaymentSuccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paymentId = searchParams.get("payment_id");
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");
  const preferenceId = searchParams.get("preference_id");

  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!paymentId && !sessionId && !orderId && !preferenceId) {
        setError("No se encontró información del pago");
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (paymentId) params.set("payment_id", paymentId);
        if (sessionId) params.set("session_id", sessionId);
        if (orderId) params.set("order_id", orderId);
        if (preferenceId) params.set("preference_id", preferenceId);

        const response = await fetch(
          `/api/payments/success?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error("Error al obtener los datos del pago");
        }

        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching payment data:", error);
        setError("Error al cargar la información del pago");
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentData();
  }, [paymentId, sessionId, orderId, preferenceId]);

  const getConsultationIcon = (type: ConsultationType) => {
    switch (type) {
      case "VIRTUAL":
        return <Video className="h-5 w-5" />;
      case "HOME_VISIT":
        return <Home className="h-5 w-5" />;
      default:
        return <Stethoscope className="h-5 w-5" />;
    }
  };

  const getConsultationLocation = (type: ConsultationType, doctor: any) => {
    switch (type) {
      case "VIRTUAL":
        return "Videollamada en línea";
      case "HOME_VISIT":
        return "Visita a domicilio";
      default:
        return `${doctor.city}, ${doctor.state}`;
    }
  };

  const addToCalendar = () => {
    if (!data) return;

    const startDate = new Date(data.appointment.scheduledAt);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later

    const title = `Consulta médica con Dr. ${data.appointment.doctor.name}`;
    const details = `Consulta ${translateConsultationType(
      data.appointment.type
    )} con Dr. ${data.appointment.doctor.name} - ${
      data.appointment.doctor.specialty
    }`;
    const location = getConsultationLocation(
      data.appointment.type,
      data.appointment.doctor
    );

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${startDate
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}/${endDate
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}&details=${encodeURIComponent(
      details
    )}&location=${encodeURIComponent(location)}`;

    window.open(googleCalendarUrl, "_blank");
  };

  const goToChat = () => {
    if (!data) return;
    router.push(`/chat?doctor=${data.appointment.doctor.name}`);
  };

  const goToDashboard = () => {
    router.push("/paciente");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-gray-600">Verificando tu pago...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Error al verificar el pago
            </h1>
            <p className="text-gray-600 mb-4">
              {error || "No se pudo verificar la información del pago"}
            </p>
            <Button onClick={() => router.push("/")} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Pago exitoso!
          </h1>
          <p className="text-lg text-gray-600">
            Tu cita médica ha sido confirmada
          </p>
        </div>

        {/* Payment Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Detalles del pago</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Monto pagado:</span>
              <span className="font-semibold text-lg">
                {formatMexicanCurrency(data.payment.amount / 100)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Método de pago:</span>
              <Badge variant="outline" className="capitalize">
                {data.payment.provider}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Fecha de pago:</span>
              <span className="text-sm">
                {format(
                  new Date(data.payment.paidAt),
                  "d 'de' MMMM 'de' yyyy 'a las' HH:mm",
                  { locale: es }
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ID de pago:</span>
              <span className="text-sm font-mono text-gray-500">
                {data.payment.id}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Appointment Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <span>Detalles de tu cita</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Doctor Info */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">
                  Dr. {data.appointment.doctor.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {data.appointment.doctor.specialty}
                </p>
              </div>
            </div>

            <Separator />

            {/* Appointment Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                {getConsultationIcon(data.appointment.type)}
                <div>
                  <p className="font-medium">
                    {translateConsultationType(data.appointment.type)}
                  </p>
                  <p className="text-sm text-gray-600">Tipo de consulta</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium">
                    {format(
                      new Date(data.appointment.scheduledAt),
                      "d 'de' MMMM",
                      { locale: es }
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatMexicanTime(new Date(data.appointment.scheduledAt))}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 md:col-span-2">
                <MapPin className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium">
                    {getConsultationLocation(
                      data.appointment.type,
                      data.appointment.doctor
                    )}
                  </p>
                  <p className="text-sm text-gray-600">Ubicación</p>
                </div>
              </div>
            </div>

            {data.appointment.notes && (
              <>
                <Separator />
                <div>
                  <p className="font-medium mb-1">Notas adicionales:</p>
                  <p className="text-sm text-gray-600">
                    {data.appointment.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Próximos pasos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={addToCalendar}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <CalendarPlus className="h-4 w-4" />
                <span>Agregar al calendario</span>
              </Button>

              <Button
                onClick={goToChat}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Chatear con el doctor</span>
              </Button>
            </div>

            <Button
              onClick={goToDashboard}
              className="w-full flex items-center justify-center space-x-2"
            >
              <span>Ver mis citas</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Important Information */}
        <Card>
          <CardContent className="p-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="font-medium text-blue-900 mb-2">
                Información importante:
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  • Recibirás un recordatorio por email 24 horas antes de tu
                  cita
                </li>
                <li>
                  • Puedes reprogramar o cancelar tu cita hasta 2 horas antes
                </li>
                <li>
                  • Para consultas virtuales, recibirás el enlace de
                  videollamada por email
                </li>
                <li>
                  • Si tienes dudas, puedes contactar al doctor a través del
                  chat
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
