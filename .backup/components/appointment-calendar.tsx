
'use client';

import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Video, 
  Home, 
  Stethoscope,
  AlertCircle
} from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMexicanCurrency, translateConsultationType, formatMexicanTime } from '@/lib/mexican-utils';
import { ConsultationType } from '@prisma/client';

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

interface AvailabilityResponse {
  available: boolean;
  reason?: string;
  slots: TimeSlot[];
  price?: number;
}

interface AppointmentCalendarProps {
  doctorId: string;
  consultationType: ConsultationType;
  onSlotSelect: (dateTime: Date, price: number) => void;
  selectedSlot?: Date;
}

export function AppointmentCalendar({ 
  doctorId, 
  consultationType, 
  onSlotSelect, 
  selectedSlot 
}: AppointmentCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener disponibilidad cuando cambia la fecha
  useEffect(() => {
    if (selectedDate) {
      fetchAvailability(selectedDate);
    }
  }, [selectedDate, consultationType, doctorId]);

  const fetchAvailability = async (date: Date) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/doctors/${doctorId}/availability?date=${date.toISOString()}&type=${consultationType}`
      );
      
      if (!response.ok) {
        throw new Error('Error al obtener disponibilidad');
      }
      
      const data = await response.json();
      setAvailability(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setAvailability(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setAvailability(null);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    const slotDate = new Date(slot.start);
    onSlotSelect(slotDate, availability?.price || 0);
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

  const getConsultationColor = () => {
    switch (consultationType) {
      case 'VIRTUAL':
        return 'badge-virtual';
      case 'HOME_VISIT':
        return 'badge-home-visit';
      default:
        return 'badge-in-person';
    }
  };

  // Deshabilitar fechas pasadas y domingos
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today || date.getDay() === 0; // Domingo = 0
  };

  return (
    <div className="space-y-6">
      {/* Tipo de consulta seleccionado */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            {getConsultationIcon()}
            <CardTitle>Consulta {translateConsultationType(consultationType)}</CardTitle>
          </div>
          <CardDescription>
            Selecciona una fecha y hora para tu cita médica
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5" />
              <span>Seleccionar Fecha</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={isDateDisabled}
              locale={es}
              className="rounded-md border"
              fromDate={new Date()}
              toDate={addDays(new Date(), 30)} // Solo 30 días adelante
            />
            <p className="text-sm text-muted-foreground mt-4">
              * No se muestran domingos ni días festivos
            </p>
          </CardContent>
        </Card>

        {/* Horarios disponibles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Horarios Disponibles</span>
            </CardTitle>
            {selectedDate && (
              <CardDescription>
                {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Selecciona una fecha para ver horarios disponibles
                </p>
              </div>
            ) : isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive font-medium mb-2">Error al cargar horarios</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button 
                  variant="outline" 
                  onClick={() => fetchAvailability(selectedDate)}
                >
                  Reintentar
                </Button>
              </div>
            ) : !availability?.available ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-2">No hay horarios disponibles</p>
                <p className="text-sm text-muted-foreground">
                  {availability?.reason || 'Este día no está disponible'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Precio */}
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Precio de consulta:</span>
                    <Badge variant="outline" className={getConsultationColor()}>
                      {formatMexicanCurrency(availability.price || 0)}
                    </Badge>
                  </div>
                </div>

                {/* Slots de tiempo */}
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {availability.slots.map((slot, index) => {
                    const slotDate = new Date(slot.start);
                    const isSelected = selectedSlot && isSameDay(slotDate, selectedSlot) && 
                      slotDate.getHours() === selectedSlot.getHours() && 
                      slotDate.getMinutes() === selectedSlot.getMinutes();

                    return (
                      <Button
                        key={index}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSlotSelect(slot)}
                        className="justify-center"
                        disabled={!slot.available}
                      >
                        {formatMexicanTime(slotDate)}
                      </Button>
                    );
                  })}
                </div>

                {availability.slots.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      No hay horarios disponibles para este día
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
