
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, X, Info, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMexicanCurrency } from '@/lib/mexican-utils';
import { toast } from 'sonner';

interface CancelAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  appointmentDate: Date;
  doctorName: string;
  price: number;
  onCancelled?: () => void;
}

export function CancelAppointmentModal({ 
  isOpen, 
  onClose, 
  appointmentId, 
  appointmentDate,
  doctorName,
  price,
  onCancelled 
}: CancelAppointmentModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calcular política de reembolso
  const now = new Date();
  const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  const getRefundInfo = () => {
    if (hoursUntilAppointment >= 24) {
      return {
        percentage: 100,
        amount: price,
        policy: 'Reembolso completo',
        description: 'Cancelación con más de 24 horas de anticipación'
      };
    } else if (hoursUntilAppointment >= 2) {
      return {
        percentage: 50,
        amount: Math.round(price * 0.5),
        policy: 'Reembolso del 50%',
        description: 'Cancelación entre 2-24 horas de anticipación'
      };
    } else {
      return {
        percentage: 0,
        amount: 0,
        policy: 'Sin reembolso',
        description: 'Cancelación con menos de 2 horas de anticipación'
      };
    }
  };

  const refundInfo = getRefundInfo();

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason.trim() || undefined
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cancelar la cita');
      }

      const result = await response.json();
      
      toast.success('Cita cancelada exitosamente', {
        description: refundInfo.amount > 0 
          ? `Reembolso de ${formatMexicanCurrency(refundInfo.amount)} procesándose`
          : 'No aplica reembolso por políticas de cancelación'
      });
      
      onCancelled?.();
      onClose();
      
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast.error('Error al cancelar la cita', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Cancelar Cita Médica</span>
          </DialogTitle>
          <DialogDescription>
            Estás a punto de cancelar tu cita con <strong>{doctorName}</strong> el{' '}
            <strong>{format(appointmentDate, "dd 'de' MMMM 'a las' HH:mm", { locale: es })}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Política de reembolso */}
          <Alert className={
            refundInfo.percentage === 100 ? 'border-green-200 bg-green-50' :
            refundInfo.percentage === 50 ? 'border-orange-200 bg-orange-50' :
            'border-red-200 bg-red-50'
          }>
            <DollarSign className={`h-4 w-4 ${
              refundInfo.percentage === 100 ? 'text-green-600' :
              refundInfo.percentage === 50 ? 'text-orange-600' :
              'text-red-600'
            }`} />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{refundInfo.policy}</span>
                  <span className="font-bold">
                    {refundInfo.amount > 0 ? formatMexicanCurrency(refundInfo.amount) : 'MX$ 0'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {refundInfo.description}
                </p>
                {refundInfo.amount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    El reembolso se procesará automáticamente en 3-5 días hábiles
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Razón de cancelación */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo de cancelación (opcional)
            </Label>
            <Textarea
              id="reason"
              placeholder="Puedes contarnos por qué cancelas tu cita..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground text-right">
              {reason.length}/300 caracteres
            </p>
          </div>

          {/* Advertencia */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="text-sm">
                <strong>Recuerda:</strong> Una vez cancelada, necesitarás agendar una nueva cita. 
                Te recomendamos reprogramar en lugar de cancelar si solo necesitas cambiar la fecha.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex flex-col space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="destructive"
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Cancelando cita...
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Confirmar Cancelación
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full"
          >
            Mantener Cita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
