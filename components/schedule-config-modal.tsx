'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, Plus, Trash2, Copy, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  maxAppointments: number;
}

interface DaySchedule {
  enabled: boolean;
  timeSlots: TimeSlot[];
}

interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface ScheduleConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId?: string;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_TIME_SLOT: TimeSlot = {
  id: '',
  startTime: '09:00',
  endTime: '17:00',
  duration: 30,
  maxAppointments: 1,
};

export function ScheduleConfigModal({ open, onOpenChange, doctorId }: ScheduleConfigModalProps) {
  const [schedule, setSchedule] = useState<WeekSchedule>({
    monday: { enabled: true, timeSlots: [{ ...DEFAULT_TIME_SLOT, id: '1' }] },
    tuesday: { enabled: true, timeSlots: [{ ...DEFAULT_TIME_SLOT, id: '2' }] },
    wednesday: { enabled: true, timeSlots: [{ ...DEFAULT_TIME_SLOT, id: '3' }] },
    thursday: { enabled: true, timeSlots: [{ ...DEFAULT_TIME_SLOT, id: '4' }] },
    friday: { enabled: true, timeSlots: [{ ...DEFAULT_TIME_SLOT, id: '5' }] },
    saturday: { enabled: false, timeSlots: [] },
    sunday: { enabled: false, timeSlots: [] },
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleDayToggle = (day: keyof WeekSchedule, enabled: boolean) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled,
        timeSlots: enabled && prev[day].timeSlots.length === 0 
          ? [{ ...DEFAULT_TIME_SLOT, id: Date.now().toString() }] 
          : prev[day].timeSlots,
      },
    }));
  };

  const addTimeSlot = (day: keyof WeekSchedule) => {
    const newSlot: TimeSlot = {
      ...DEFAULT_TIME_SLOT,
      id: Date.now().toString(),
    };

    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeSlots: [...prev[day].timeSlots, newSlot],
      },
    }));
  };

  const removeTimeSlot = (day: keyof WeekSchedule, slotId: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeSlots: prev[day].timeSlots.filter(slot => slot.id !== slotId),
      },
    }));
  };

  const updateTimeSlot = (day: keyof WeekSchedule, slotId: string, updates: Partial<TimeSlot>) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeSlots: prev[day].timeSlots.map(slot =>
          slot.id === slotId ? { ...slot, ...updates } : slot
        ),
      },
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const hasEnabledDays = Object.values(schedule).some(day => day.enabled);
      if (!hasEnabledDays) {
        toast.error('Debe habilitar al menos un día de la semana');
        return;
      }

      for (const [dayKey, daySchedule] of Object.entries(schedule)) {
        if (daySchedule.enabled) {
          for (const slot of daySchedule.timeSlots) {
            if (slot.startTime >= slot.endTime) {
              const dayName = DAYS_OF_WEEK.find(d => d.key === dayKey)?.label;
              toast.error(`Horario inválido en ${dayName}: la hora de inicio debe ser menor que la de fin`);
              return;
            }
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Horarios guardados correctamente');
      onOpenChange(false);
    } catch (error) {
      toast.error('Error al guardar los horarios');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Configurar Horarios de Atención</span>
          </DialogTitle>
          <DialogDescription>
            Define tus horarios de atención para cada día de la semana.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {DAYS_OF_WEEK.map((day) => {
              const daySchedule = schedule[day.key as keyof WeekSchedule];
              return (
                <Card key={day.key} className={daySchedule.enabled ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <span>{day.label}</span>
                        {daySchedule.enabled && (
                          <Badge variant="secondary" className="text-xs">
                            {daySchedule.timeSlots.length} horario{daySchedule.timeSlots.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </CardTitle>
                      <Switch
                        checked={daySchedule.enabled}
                        onCheckedChange={(enabled) => handleDayToggle(day.key as keyof WeekSchedule, enabled)}
                      />
                    </div>
                  </CardHeader>

                  {daySchedule.enabled && (
                    <CardContent className="space-y-4">
                      {daySchedule.timeSlots.map((slot, index) => (
                        <div key={slot.id} className="p-4 border rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">
                              Horario {index + 1}
                            </span>
                            {daySchedule.timeSlots.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeTimeSlot(day.key as keyof WeekSchedule, slot.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Hora inicio</Label>
                              <Input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) => updateTimeSlot(day.key as keyof WeekSchedule, slot.id, { startTime: e.target.value })}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Hora fin</Label>
                              <Input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) => updateTimeSlot(day.key as keyof WeekSchedule, slot.id, { endTime: e.target.value })}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Duración (min)</Label>
                              <Select
                                value={slot.duration.toString()}
                                onValueChange={(value) => updateTimeSlot(day.key as keyof WeekSchedule, slot.id, { duration: parseInt(value) })}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="15">15 min</SelectItem>
                                  <SelectItem value="30">30 min</SelectItem>
                                  <SelectItem value="45">45 min</SelectItem>
                                  <SelectItem value="60">60 min</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Max. citas</Label>
                              <Select
                                value={slot.maxAppointments.toString()}
                                onValueChange={(value) => updateTimeSlot(day.key as keyof WeekSchedule, slot.id, { maxAppointments: parseInt(value) })}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 cita</SelectItem>
                                  <SelectItem value="2">2 citas</SelectItem>
                                  <SelectItem value="3">3 citas</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addTimeSlot(day.key as keyof WeekSchedule)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar horario
                      </Button>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Horarios
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
