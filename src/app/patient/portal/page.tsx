'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  MessageCircle,
  FileText,
  Plus,
  Search,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  MapPin,
  Stethoscope
} from 'lucide-react';

interface Doctor {
  id: string;
  name: string;
  email: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  hospitalAdscripcion?: string;
  availability: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }[];
}

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  type: string;
  notes?: string;
  doctor: {
    id: string;
    name: string;
    specialty: string;
  };
  payment?: {
    id: string;
    amount: number;
    status: string;
  };
  chatRoom?: {
    id: string;
    status: string;
  };
}

interface MedicalFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
  appointment?: {
    id: string;
    scheduledAt: string;
    doctor: {
      name: string;
    };
  };
}

interface ChatRoom {
  id: string;
  status: string;
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  unreadCount: number;
  appointment: {
    id: string;
    scheduledAt: string;
    doctor: {
      name: string;
      specialty: string;
    };
  };
}

const STATUS_COLORS = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-orange-100 text-orange-800'
};

const STATUS_ICONS = {
  SCHEDULED: Clock,
  CONFIRMED: CheckCircle,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  NO_SHOW: AlertCircle
};

export default function PatientPortal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  
  // Data states
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicalFiles, setMedicalFiles] = useState<MedicalFile[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  
  // Dialog states
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  
  // Form states
  const [bookingForm, setBookingForm] = useState({
    doctorId: '',
    date: '',
    time: '',
    type: 'CONSULTATION',
    notes: ''
  });
  const [submittingBooking, setSubmittingBooking] = useState(false);
  
  // Filters
  const [doctorFilters, setDoctorFilters] = useState({
    specialty: '',
    search: ''
  });
  
  const [appointmentFilters, setAppointmentFilters] = useState({
    status: '',
    startDate: '',
    endDate: ''
  });

  const loadDoctors = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (doctorFilters.specialty) queryParams.append('specialty', doctorFilters.specialty);
      if (doctorFilters.search) queryParams.append('search', doctorFilters.search);
      
      const response = await fetch(`/api/doctors?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setDoctors(data.doctors || []);
      }
    } catch (_error) {
      // Error loading doctors - silent fail
    }
  }, [doctorFilters.specialty, doctorFilters.search]);

  const loadAppointments = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(appointmentFilters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
      
      const response = await fetch(`/api/appointments?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setAppointments(data.appointments || []);
      }
    } catch (_error) {
      // Error loading appointments - silent fail
    }
  }, [appointmentFilters]);

  const loadMedicalFiles = useCallback(async () => {
    try {
      const response = await fetch('/api/files/medical');
      if (response.ok) {
        const data = await response.json();
        setMedicalFiles(data.files || []);
      }
    } catch (_error) {
      // Error loading medical files - silent fail
    }
  }, []);

  const loadChatRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/rooms');
      if (response.ok) {
        const data = await response.json();
        setChatRooms(data.rooms || []);
      }
    } catch (_error) {
      // Error loading chat rooms - silent fail
    }
  }, []);



  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'PATIENT') {
      router.push('/auth/signin');
      return;
    }

    const loadAllData = async () => {
      try {
        await Promise.all([
          loadDoctors(),
          loadAppointments(),
          loadMedicalFiles(),
          loadChatRooms()
        ]);
      } catch (_error) {
        toast.error('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [session, status, router, loadDoctors, loadAppointments, loadMedicalFiles, loadChatRooms]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBooking(true);

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          doctorId: bookingForm.doctorId,
          scheduledAt: `${bookingForm.date}T${bookingForm.time}:00.000Z`,
          type: bookingForm.type,
          notes: bookingForm.notes
        })
      });

      if (response.ok) {
        toast.success('Cita agendada correctamente');
        setShowBookingDialog(false);
        setBookingForm({ doctorId: '', date: '', time: '', type: 'CONSULTATION', notes: '' });
        loadAppointments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al agendar la cita');
      }
    } catch (_error) {
       toast.error('Error al agendar la cita');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'CANCELLED' })
      });

      if (response.ok) {
        toast.success('Cita cancelada correctamente');
        loadAppointments();
      } else {
        toast.error('Error al cancelar la cita');
      }
    } catch (_error) {
       toast.error('Error al cancelar la cita');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || AlertCircle;
    return <Icon className="h-4 w-4" />;
  };

  const getAvailableTimeSlots = (doctorId: string, date: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor || !date) return [];

    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();
    
    const availability = doctor.availability.find(a => 
      a.dayOfWeek === dayOfWeek && a.isActive
    );
    
    if (!availability) return [];

    const slots = [];
    const start = new Date(`2000-01-01T${availability.startTime}`);
    const end = new Date(`2000-01-01T${availability.endTime}`);
    
    while (start < end) {
      slots.push(start.toTimeString().slice(0, 5));
      start.setMinutes(start.getMinutes() + 30);
    }
    
    return slots;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Portal del Paciente</h1>
        <p className="text-gray-600 mt-2">Gestiona tus citas, consultas y archivos médicos</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Citas Programadas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {appointments.filter(a => ['SCHEDULED', 'CONFIRMED'].includes(a.status)).length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Chats Activos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {chatRooms.filter(r => r.status === 'ACTIVE').length}
                </p>
              </div>
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Archivos Médicos</p>
                <p className="text-2xl font-bold text-gray-900">{medicalFiles.length}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Doctores Disponibles</p>
                <p className="text-2xl font-bold text-gray-900">{doctors.length}</p>
              </div>
              <Stethoscope className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="appointments">Mis Citas</TabsTrigger>
          <TabsTrigger value="doctors">Doctores</TabsTrigger>
          <TabsTrigger value="chat">Consultas</TabsTrigger>
          <TabsTrigger value="files">Archivos Médicos</TabsTrigger>
        </TabsList>

        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mis Citas</CardTitle>
                  <CardDescription>Gestiona tus citas médicas</CardDescription>
                </div>
                <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Agendar Cita
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Agendar Nueva Cita</DialogTitle>
                      <DialogDescription>
                        Selecciona un doctor y horario disponible
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleBookAppointment} className="space-y-4">
                      <div>
                        <Label htmlFor="doctor">Doctor</Label>
                        <Select
                          value={bookingForm.doctorId}
                          onValueChange={(value) => setBookingForm(prev => ({ ...prev, doctorId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            {doctors.map((doctor) => (
                              <SelectItem key={doctor.id} value={doctor.id}>
                                <div className="flex items-center gap-2">
                                  <div>
                                    <p className="font-medium">{doctor.name}</p>
                                    <p className="text-sm text-gray-600">{doctor.specialty}</p>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="date">Fecha</Label>
                        <Input
                          id="date"
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={bookingForm.date}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, date: e.target.value, time: '' }))}
                          required
                        />
                      </div>

                      {bookingForm.doctorId && bookingForm.date && (
                        <div>
                          <Label htmlFor="time">Horario</Label>
                          <Select
                            value={bookingForm.time}
                            onValueChange={(value) => setBookingForm(prev => ({ ...prev, time: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona horario" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableTimeSlots(bookingForm.doctorId, bookingForm.date).map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="type">Tipo de Consulta</Label>
                        <Select
                          value={bookingForm.type}
                          onValueChange={(value) => setBookingForm(prev => ({ ...prev, type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONSULTATION">Consulta General</SelectItem>
                            <SelectItem value="FOLLOW_UP">Seguimiento</SelectItem>
                            <SelectItem value="EMERGENCY">Urgencia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="notes">Notas (Opcional)</Label>
                        <Textarea
                          id="notes"
                          value={bookingForm.notes}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Describe tus síntomas o motivo de consulta..."
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button type="submit" disabled={submittingBooking} className="flex-1">
                          {submittingBooking ? 'Agendando...' : 'Agendar Cita'}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowBookingDialog(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Appointment Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={appointmentFilters.status}
                    onValueChange={(value) => setAppointmentFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="SCHEDULED">Programada</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmada</SelectItem>
                      <SelectItem value="COMPLETED">Completada</SelectItem>
                      <SelectItem value="CANCELLED">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="startDate">Desde</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={appointmentFilters.startDate}
                    onChange={(e) => setAppointmentFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate">Hasta</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={appointmentFilters.endDate}
                    onChange={(e) => setAppointmentFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Appointments List */}
              <div className="space-y-4">
                {appointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No tienes citas programadas</p>
                ) : (
                  appointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{appointment.doctor.name}</p>
                            <p className="text-sm text-gray-600">{appointment.doctor.specialty}</p>
                            <p className="text-sm text-gray-500">
                              {formatDate(appointment.scheduledAt)}
                            </p>
                          </div>
                        </div>
                        {appointment.notes && (
                          <p className="text-sm text-gray-600 mt-2">{appointment.notes}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge className={STATUS_COLORS[appointment.status as keyof typeof STATUS_COLORS]}>
                          {getStatusIcon(appointment.status)}
                          <span className="ml-1">{appointment.status}</span>
                        </Badge>
                        
                        <div className="flex gap-2">
                          {appointment.chatRoom && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/chat?room=${appointment.chatRoom?.id}`)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelAppointment(appointment.id)}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctors Tab */}
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <CardTitle>Doctores Disponibles</CardTitle>
              <CardDescription>Encuentra y agenda con especialistas</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Doctor Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="search"
                      placeholder="Buscar por nombre..."
                      className="pl-10"
                      value={doctorFilters.search}
                      onChange={(e) => setDoctorFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <Label htmlFor="specialty">Especialidad</Label>
                  <Select
                    value={doctorFilters.specialty}
                    onValueChange={(value) => setDoctorFilters(prev => ({ ...prev, specialty: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      <SelectItem value="GENERAL">Medicina General</SelectItem>
                      <SelectItem value="CARDIOLOGY">Cardiología</SelectItem>
                      <SelectItem value="DERMATOLOGY">Dermatología</SelectItem>
                      <SelectItem value="PEDIATRICS">Pediatría</SelectItem>
                      <SelectItem value="PSYCHIATRY">Psiquiatría</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Doctors Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doctors.map((doctor) => (
                  <Card key={doctor.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{doctor.name}</h3>
                          <p className="text-gray-600">{doctor.specialty}</p>
                          {doctor.hospitalAdscripcion && (
                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {doctor.hospitalAdscripcion}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="text-sm font-medium">{doctor.rating}</span>
                          </div>
                          <p className="text-xs text-gray-500">({doctor.reviewCount} reseñas)</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <p className="text-sm font-medium text-gray-700">Disponibilidad:</p>
                        <div className="flex flex-wrap gap-1">
                          {doctor.availability.filter(a => a.isActive).map((slot, index) => {
                            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                            return (
                              <Badge key={index} variant="outline" className="text-xs">
                                {days[slot.dayOfWeek]} {slot.startTime}-{slot.endTime}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setBookingForm(prev => ({ ...prev, doctorId: doctor.id }));
                          setShowBookingDialog(true);
                        }}
                      >
                        Agendar Cita
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Mis Consultas</CardTitle>
              <CardDescription>Chats activos con doctores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chatRooms.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No tienes consultas activas</p>
                ) : (
                  chatRooms.map((room) => (
                    <div key={room.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{room.appointment.doctor.name}</p>
                            <p className="text-sm text-gray-600">{room.appointment.doctor.specialty}</p>
                            <p className="text-sm text-gray-500">
                              Cita: {formatDate(room.appointment.scheduledAt)}
                            </p>
                            {room.lastMessage && (
                              <p className="text-sm text-gray-600 mt-1">
                                Último mensaje: {room.lastMessage.content.substring(0, 50)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {room.unreadCount > 0 && (
                          <Badge className="bg-red-100 text-red-800">
                            {room.unreadCount} nuevos
                          </Badge>
                        )}
                        
                        <Badge className={room.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {room.status}
                        </Badge>
                        
                        <Button
                          size="sm"
                          onClick={() => router.push(`/chat?room=${room.id}`)}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Abrir Chat
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Archivos Médicos</CardTitle>
                  <CardDescription>Gestiona tus documentos médicos</CardDescription>
                </div>
                <Button className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Subir Archivo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {medicalFiles.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No tienes archivos médicos</p>
                ) : (
                  medicalFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="font-medium">{file.fileName}</p>
                          <p className="text-sm text-gray-600">
                            {formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}
                          </p>
                          {file.description && (
                            <p className="text-sm text-gray-500">{file.description}</p>
                          )}
                          {file.appointment && (
                            <p className="text-xs text-gray-500">
                              Cita con {file.appointment.doctor.name} - {formatDate(file.appointment.scheduledAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}