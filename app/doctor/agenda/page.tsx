'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, User, Phone, MapPin, Video, Home, CheckCircle, X, Eye, AlertCircle } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScheduleConfigModal } from '@/components/schedule-config-modal';
import { useToast } from '@/hooks/use-toast';

interface Appointment {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  type: 'presencial' | 'virtual' | 'domicilio';
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}

export default function DoctorAgendaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'DOCTOR') {
      router.push('/unauthorized');
      return;
    }

    loadAppointments();
  }, [session, status, router, selectedDate]);

  const loadAppointments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/appointments');
      
      if (!response.ok) {
        throw new Error('Error al cargar las citas');
      }

      const data = await response.json();
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppointmentAction = async (appointmentId: string, action: 'confirm' | 'cancel' | 'complete') => {
    setActionLoading(appointmentId);
    try {
      const newStatus = action === 'confirm' ? 'confirmed' : action === 'cancel' ? 'cancelled' : 'completed';
      
      const response = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId,
          status: newStatus
        }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la cita');
      }

      // Actualizar el estado local
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, status: newStatus }
            : apt
        )
      );

      const actionText = action === 'confirm' ? 'confirmada' : action === 'cancel' ? 'cancelada' : 'completada';
      toast({
        title: "Éxito",
        description: `Cita ${actionText} correctamente`,
      });
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la cita",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentModal(true);
  };

  const getAppointmentsForDate = (date: Date): Appointment[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(apt => apt.date === dateStr);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendiente';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'presencial': return <MapPin className="h-4 w-4" />;
      case 'virtual': return <Video className="h-4 w-4" />;
      case 'domicilio': return <Home className="h-4 w-4" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  const getTypeText = (type: string): string => {
    switch (type) {
      case 'presencial': return 'Presencial';
      case 'virtual': return 'Virtual';
      case 'domicilio': return 'Domicilio';
      default: return type;
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i);
    return date;
  });

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      <div className="flex-1 bg-muted/30">
        <div className="max-width-container py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Mi Agenda</h1>
                <p className="text-muted-foreground mt-2">Gestiona tus citas y horarios</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex rounded-md shadow-sm">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'outline'}
                    onClick={() => setViewMode('day')}
                    className="rounded-r-none"
                  >
                    Día
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'outline'}
                    onClick={() => setViewMode('week')}
                    className="rounded-l-none"
                  >
                    Semana
                  </Button>
                </div>
                <Button onClick={() => setShowScheduleModal(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Configurar Horarios
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Calendario y navegación */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Navegación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Fecha seleccionada</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          value={format(selectedDate, 'yyyy-MM-dd')}
                          onChange={(e) => setSelectedDate(new Date(e.target.value))}
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">Resumen de hoy</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Total de citas</span>
                          <span className="font-semibold">{getAppointmentsForDate(new Date()).length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Confirmadas</span>
                          <span className="font-semibold text-green-600">
                            {getAppointmentsForDate(new Date()).filter(apt => apt.status === 'confirmed').length}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Pendientes</span>
                          <span className="font-semibold text-yellow-600">
                            {getAppointmentsForDate(new Date()).filter(apt => apt.status === 'pending').length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Próximas citas */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Próximas Citas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {appointments
                      .filter(apt => new Date(apt.date + 'T' + apt.time) > new Date())
                      .slice(0, 3)
                      .map((appointment) => (
                        <div key={appointment.id} className="flex items-center space-x-3 p-2 bg-muted rounded-md">
                          <div className="flex-shrink-0">
                            {getTypeIcon(appointment.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {appointment.patientName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(appointment.date), 'dd MMM', { locale: es })} - {appointment.time}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Vista principal */}
            <div className="lg:col-span-3">
              {viewMode === 'day' ? (
                /* Vista por día */
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          {format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: es })}
                        </CardTitle>
                        <CardDescription>
                          {getAppointmentsForDate(selectedDate).length} citas programadas
                        </CardDescription>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                        >
                          ← Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                        >
                          Siguiente →
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {getAppointmentsForDate(selectedDate).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>No hay citas programadas para este día</p>
                        </div>
                      ) : (
                        getAppointmentsForDate(selectedDate)
                          .sort((a, b) => a.time.localeCompare(b.time))
                          .map((appointment) => (
                            <div key={appointment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-4">
                                  <div className="flex-shrink-0">
                                    <Avatar>
                                      <AvatarFallback>
                                        {appointment.patientName.split(' ').map(n => n[0]).join('')}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <h3 className="text-lg font-semibold">{appointment.patientName}</h3>
                                      <Badge className={getStatusColor(appointment.status)}>
                                        {getStatusText(appointment.status)}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                                      <div className="flex items-center space-x-1">
                                        <Clock className="h-4 w-4" />
                                        <span>{appointment.time}</span>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        {getTypeIcon(appointment.type)}
                                        <span>{getTypeText(appointment.type)}</span>
                                      </div>
                                      {appointment.patientPhone && (
                                        <div className="flex items-center space-x-1">
                                          <Phone className="h-4 w-4" />
                                          <span>{appointment.patientPhone}</span>
                                        </div>
                                      )}
                                    </div>
                                    {appointment.notes && (
                                      <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                        {appointment.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  {appointment.status === 'pending' && (
                                    <>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => handleAppointmentAction(appointment.id, 'confirm')}
                                        disabled={actionLoading === appointment.id}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Confirmar
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => handleAppointmentAction(appointment.id, 'cancel')}
                                        disabled={actionLoading === appointment.id}
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Cancelar
                                      </Button>
                                    </>
                                  )}
                                  {appointment.status === 'confirmed' && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleAppointmentAction(appointment.id, 'complete')}
                                      disabled={actionLoading === appointment.id}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Completar
                                    </Button>
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleViewAppointment(appointment)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Ver
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                /* Vista por semana */
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>
                        Semana del {format(weekDays[0], 'dd MMM', { locale: es })} al {format(weekDays[6], 'dd MMM yyyy', { locale: es })}
                      </CardTitle>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                        >
                          ← Semana anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                        >
                          Semana siguiente →
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-4">
                      {weekDays.map((day, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="text-center mb-3">
                            <div className="text-sm font-medium text-foreground">
                              {format(day, 'EEE', { locale: es })}
                            </div>
                            <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground'}`}>
                              {format(day, 'dd')}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {getAppointmentsForDate(day).map((appointment) => (
                              <div
                                key={appointment.id}
                                className="text-xs p-2 bg-primary/10 border border-primary/20 rounded cursor-pointer hover:bg-primary/20"
                                onClick={() => setSelectedDate(day)}
                              >
                                <div className="font-medium truncate">{appointment.time}</div>
                                <div className="text-muted-foreground truncate">{appointment.patientName}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Modal de configuración de horarios */}
          <ScheduleConfigModal
            open={showScheduleModal}
            onOpenChange={setShowScheduleModal}
            doctorId={session?.user?.id}
          />

          {/* Modal de detalle de cita */}
          <Dialog open={showAppointmentModal} onOpenChange={setShowAppointmentModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Detalle de Cita</span>
                </DialogTitle>
                <DialogDescription>
                  Información completa de la cita médica
                </DialogDescription>
              </DialogHeader>

              {selectedAppointment && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Paciente</Label>
                      <p className="text-lg font-semibold">{selectedAppointment.patientName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
                      <div className="mt-1">
                        <Badge className={getStatusColor(selectedAppointment.status)}>
                          {getStatusText(selectedAppointment.status)}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Fecha y Hora</Label>
                      <p className="text-sm">
                        {format(parseISO(selectedAppointment.date), 'dd MMMM yyyy', { locale: es })} - {selectedAppointment.time}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Tipo de Consulta</Label>
                      <div className="flex items-center space-x-1 mt-1">
                        {getTypeIcon(selectedAppointment.type)}
                        <span className="text-sm">{getTypeText(selectedAppointment.type)}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                      <p className="text-sm">{selectedAppointment.patientEmail}</p>
                    </div>
                    {selectedAppointment.patientPhone && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Teléfono</Label>
                        <p className="text-sm">{selectedAppointment.patientPhone}</p>
                      </div>
                    )}
                  </div>

                  {selectedAppointment.notes && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Notas</Label>
                      <div className="mt-2 p-3 bg-muted rounded-md">
                        <p className="text-sm">{selectedAppointment.notes}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setShowAppointmentModal(false)}>
                      Cerrar
                    </Button>
                    {selectedAppointment.status === 'pending' && (
                      <>
                        <Button 
                          onClick={() => {
                            handleAppointmentAction(selectedAppointment.id, 'confirm');
                            setShowAppointmentModal(false);
                          }}
                          disabled={actionLoading === selectedAppointment.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirmar Cita
                        </Button>
                        <Button 
                          variant="destructive"
                          onClick={() => {
                            handleAppointmentAction(selectedAppointment.id, 'cancel');
                            setShowAppointmentModal(false);
                          }}
                          disabled={actionLoading === selectedAppointment.id}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar Cita
                        </Button>
                      </>
                    )}
                    {selectedAppointment.status === 'confirmed' && (
                      <Button 
                        onClick={() => {
                          handleAppointmentAction(selectedAppointment.id, 'complete');
                          setShowAppointmentModal(false);
                        }}
                        disabled={actionLoading === selectedAppointment.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Completada
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Footer />
    </div>
  );
} 