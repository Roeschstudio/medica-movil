
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PaymentMethodSelector } from '@/components/payment-method-selector';
import { 
  Calendar,
  Clock,
  CreditCard,
  MapPin,
  Video,
  Home,
  Stethoscope,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMexicanCurrency, translateConsultationType, formatMexicanTime } from '@/lib/mexican-utils';
import { ConsultationType } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MexicanPaymentMethod, MEXICAN_PAYMENT_METHODS } from '@/lib/stripe';

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
  price
}: AppointmentBookingModalProps) {
  const [notes, setNotes] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<MexicanPaymentMethod>(MEXICAN_PAYMENT_METHODS.CARD);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Primero crear la cita
      const appointmentResponse = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorId: doctor.id,
          type: consultationType,
          scheduledAt: selectedDateTime.toISOString(),
          notes: notes.trim() || undefined
        }),
      });

      if (!appointmentResponse.ok) {
        const error = await appointmentResponse.json();
        throw new Error(error.error || 'Error al crear la cita');
      }

      const appointment = await appointmentResponse.json();

      // Luego crear la sesión de pago
      const paymentResponse = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId: appointment.id,
          paymentMethod: selectedPaymentMethod
        }),
      });

      if (!paymentResponse.ok) {
        const error = await paymentResponse.json();
        throw new Error(error.error || 'Error al crear la sesión de pago');
      }

      const paymentSession = await paymentResponse.json();

      // Redirigir a Stripe Checkout
      if (paymentSession.sessionUrl) {
        window.location.href = paymentSession.sessionUrl;
      } else {
        throw new Error('No se pudo obtener la URL de pago');
      }
      
    } catch (error) {
      console.error('Error creating appointment or payment:', error);
      toast.error('Error al procesar la cita', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo'
      });
      setIsSubmitting(false); // Solo resetear si hay error, no en éxito
    }
  };

  const getConsultationIcon = () => {
    switch (consultationType) {
      case 'VIRTUAL':
        return <Video className="h-4 w-4" />;
      case 'HOME_VISIT':
        return <Home className="h-4 w-4" />;
      default:
        return <Stethoscope className="h-4 w-4" />;
    }
  };

  const getConsultationDetails = () => {
    switch (consultationType) {
      case 'VIRTUAL':
        return {
          title: 'Consulta Virtual',
          description: 'Videollamada desde tu hogar',
          location: 'En línea'
        };
      case 'HOME_VISIT':
        return {
          title: 'Consulta a Domicilio',
          description: 'El doctor visitará tu domicilio',
          location: 'Tu domicilio'
        };
      default:
        return {
          title: 'Consulta Presencial',
          description: 'Visita al consultorio del doctor',
          location: `${doctor.city}, ${doctor.state}`
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
              <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
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
                    {format(selectedDateTime, 'EEEE', { locale: es })}
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
            <Label htmlFor="notes">
              Notas adicionales (opcional)
            </Label>
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
            selectedMethod={selectedPaymentMethod}
            onMethodChange={setSelectedPaymentMethod}
            price={price}
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
                <p className="font-medium text-amber-800">Información de pago</p>
                <p className="text-amber-700">
                  Serás redirigido a la plataforma de pago segura para completar tu cita.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creando cita...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar y Pagar {formatMexicanCurrency(price)}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
