'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, User, Phone, MapPin, Video, Home, CheckCircle, X, Eye } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScheduleConfigModal } from '@/components/schedule-config-modal';

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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

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
      // Simulamos datos de citas para el demo
      const mockAppointments: Appointment[] = [
        {
          id: '1',
          patientName: 'María García López',
          patientEmail: 'maria.garcia@email.com',
          patientPhone: '+52 55 1234 5678',
          type: 'presencial',
          date: format(new Date(), 'yyyy-MM-dd'),
          time: '09:00',
          status: 'confirmed',
          notes: 'Consulta de seguimiento'
        },
        {
          id: '2',
          patientName: 'Carlos Rodríguez',
          patientEmail: 'carlos.rodriguez@email.com',
          patientPhone: '+52 55 9876 5432',
          type: 'virtual',
          date: format(new Date(), 'yyyy-MM-dd'),
          time: '11:30',
          status: 'pending',
          notes: 'Primera consulta'
        },
        {
          id: '3',
          patientName: 'Ana Martínez',
          patientEmail: 'ana.martinez@email.com',
          type: 'domicilio',
          date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
          time: '15:00',
          status: 'confirmed',
          notes: 'Consulta a domicilio - Zona Centro'
        },
        {
          id: '4',
          patientName: 'Luis Hernández',
          patientEmail: 'luis.hernandez@email.com',
          type: 'presencial',
          date: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
          time: '10:00',
          status: 'completed'
        }
      ];

      setAppointments(mockAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setIsLoading(false);
    }
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mi Agenda</h1>
              <p className="text-gray-600 mt-2">Gestiona tus citas y horarios</p>
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
                    <label className="text-sm font-medium text-gray-700">Fecha seleccionada</label>
                    <div className="mt-1">
                      <input
                        type="date"
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Resumen de hoy</h4>
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
                      <div key={appointment.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-md">
                        <div className="flex-shrink-0">
                          {getTypeIcon(appointment.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {appointment.patientName}
                          </p>
                          <p className="text-xs text-gray-500">
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
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
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
                                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
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
                                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                      {appointment.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                {appointment.status === 'pending' && (
                                  <>
                                    <Button size="sm" variant="outline">
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Confirmar
                                    </Button>
                                    <Button size="sm" variant="outline">
                                      <X className="h-4 w-4 mr-1" />
                                      Cancelar
                                    </Button>
                                  </>
                                )}
                                <Button size="sm" variant="outline">
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
                          <div className="text-sm font-medium text-gray-900">
                            {format(day, 'EEE', { locale: es })}
                          </div>
                          <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-900'}`}>
                            {format(day, 'dd')}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {getAppointmentsForDate(day).map((appointment) => (
                            <div
                              key={appointment.id}
                              className="text-xs p-2 bg-blue-50 border border-blue-200 rounded cursor-pointer hover:bg-blue-100"
                              onClick={() => setSelectedDate(day)}
                            >
                              <div className="font-medium truncate">{appointment.time}</div>
                              <div className="text-gray-600 truncate">{appointment.patientName}</div>
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
      </div>
    </div>
  );
} 