"use client";

import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  formatMexicanCurrency,
  formatMexicanTime,
  translateConsultationType,
} from "@/lib/mexican-utils";
import { ConsultationType } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  Calendar,
  Clock,
  CreditCard,
  Home,
  MapPin,
  Stethoscope,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  city: string;
  state: string;
  profileImage?: string;
}

interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor;
  consultationType: ConsultationType;
  selectedDateTime: Date;
  price: number;
}

export function AppointmentBookingModal({
  isOpen,
  onClose,
  doctor,
  consultationType,
  selectedDateTime,
  price,
}: AppointmentBookingModalProps) {
  const [notes, setNotes] = useState("");
  const [selectedProvider, setSelectedProvider] =
    useState<PaymentProviderType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<any>(null);
  const router = useRouter();

  const handlePaymentInitiation = async (provider: PaymentProviderType) => {
    let appointmentId: string;

    // Create appointment if it doesn't exist
    if (!createdAppointment) {
      try {
        const appointment = await createAppointment();
        appointmentId = appointment.id;
      } catch (error) {
        return; // Error already handled in createAppointment
      }
    } else {
      appointmentId = createdAppointment.id;
    }

    const createAppointment = async () => {
      setIsSubmitting(true);
      setPaymentError(null);

      try {
        const appointmentResponse = await fetch("/api/appointments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            doctorId: doctor.id,
            type: consultationType,
            scheduledAt: selectedDateTime.toISOString(),
            notes: notes.trim() || undefined,
          }),
        });

        if (!appointmentResponse.ok) {
          const error = await appointmentResponse.json();
          throw new Error(error.error || "Error al crear la cita");
        }

        const appointment = await appointmentResponse.json();
        setCreatedAppointment(appointment);
        return appointment;
      } catch (error) {
        console.error("Error:", error);
        setPaymentError(
          error instanceof Error ? error.message : "Error inesperado"
        );
        toast.error(
          error instanceof Error ? error.message : "Error inesperado"
        );
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    };
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      let paymentResponse;

      switch (provider) {
        case "stripe":
          paymentResponse = await fetch("/api/payments/stripe/create-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId }),
          });
          break;

        case "paypal":
          paymentResponse = await fetch("/api/payments/paypal/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId }),
          });
          break;

        case "mercadopago":
          paymentResponse = await fetch(
            "/api/payments/mercadopago/create-preference",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appointmentId }),
            }
          );
          break;

        default:
          throw new Error(`Proveedor de pago no soportado: ${provider}`);
      }

      if (!paymentResponse.ok) {
        const error = await paymentResponse.json();
        throw new Error(error.error || "Error al crear la sesión de pago");
      }

      const paymentData = await paymentResponse.json();

      // Redirigir al checkout del proveedor
      if (paymentData.checkoutUrl || paymentData.sessionUrl) {
        window.location.href =
          paymentData.checkoutUrl || paymentData.sessionUrl;
      } else {
        throw new Error("No se pudo obtener la URL de pago");
      }
    } catch (error) {
      console.error("Error initiating payment:", error);
      setPaymentError(
        error instanceof Error ? error.message : "Error al procesar el pago"
      );
      toast.error("Error al procesar el pago", {
        description:
          error instanceof Error ? error.message : "Inténtalo de nuevo",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getConsultationIcon = () => {
    switch (consultationType) {
      case "VIRTUAL":
        return <Video className="h-4 w-4" />;
      case "HOME_VISIT":
        return <Home className="h-4 w-4" />;
      default:
        return <Stethoscope className="h-4 w-4" />;
    }
  };

  const getConsultationDetails = () => {
    switch (consultationType) {
      case "VIRTUAL":
        return {
          title: "Consulta Virtual",
          description: "Videollamada desde tu hogar",
          location: "En línea",
        };
      case "HOME_VISIT":
        return {
          title: "Consulta a Domicilio",
          description: "El doctor visitará tu domicilio",
          location: "Tu domicilio",
        };
      default:
        return {
          title: "Consulta Presencial",
          description: "Visita al consultorio del doctor",
          location: `${doctor.city}, ${doctor.state}`,
        };
    }
  };

  const consultation = getConsultationDetails();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Confirmar Cita Médica</span>
          </DialogTitle>
          <DialogDescription>
            Revisa los detalles de tu cita antes de confirmar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del doctor */}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{doctor.name}</h3>
              <p className="text-sm text-muted-foreground">
                {doctor.specialty}
              </p>
            </div>
          </div>

          <Separator />

          {/* Detalles de la cita */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getConsultationIcon()}
                <span className="font-medium">{consultation.title}</span>
              </div>
              <Badge variant="outline">
                {translateConsultationType(consultationType)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {format(selectedDateTime, "dd 'de' MMMM", { locale: es })}
                  </p>
                  <p className="text-muted-foreground">
                    {format(selectedDateTime, "EEEE", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {formatMexicanTime(selectedDateTime)}
                  </p>
                  <p className="text-muted-foreground">30 min</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{consultation.location}</p>
                  <p className="text-muted-foreground text-xs">
                    {consultation.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Notas opcionales */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas adicionales (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Describe tus síntomas o motivo de consulta..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/500 caracteres
            </p>
          </div>

          <Separator />

          {/* Método de pago */}
          <PaymentMethodSelector
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
            price={price}
            onPaymentInitiate={handlePaymentInitiation}
            isProcessing={isProcessingPayment}
            error={paymentError}
          />

          <Separator />

          {/* Precio */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Total a pagar:</span>
            </div>
            <span className="text-xl font-bold text-primary">
              {formatMexicanCurrency(price)}
            </span>
          </div>

          {/* Advertencia de pago */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">
                  Información de pago
                </p>
                <p className="text-amber-700">
                  Serás redirigido a la plataforma de pago segura para completar
                  tu cita.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col space-y-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting || isProcessingPayment}
            className="w-full"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
