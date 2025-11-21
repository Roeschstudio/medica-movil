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
import { toast } from 'sonner';
import {
  User,
  Calendar,
  Clock,
  DollarSign,
  Star,
  MessageSquare,
  Video,
  CheckCircle,
  AlertCircle,
  Settings,
  Save
} from 'lucide-react';

interface DoctorProfile {
  id: string;
  bio: string;
  experience: number;
  consultationFee: number;
  rating: number;
  isActive: boolean;
  cedulaProfesional?: string;
  numeroIMSS?: string;
  hospitalAdscripcion?: string;
  turno?: string;
  categoria?: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  specialty?: {
    id: string;
    name: string;
  };
  _count: {
    appointments: number;
    chatRooms: number;
    videoSessions: number;
  };
}

interface Specialty {
  id: string;
  name: string;
}

interface Availability {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const DAYS_OF_WEEK = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

const TURNOS = [
  { value: 'MATUTINO', label: 'Matutino' },
  { value: 'VESPERTINO', label: 'Vespertino' },
  { value: 'NOCTURNO', label: 'Nocturno' },
  { value: 'JORNADA_ACUMULADA', label: 'Jornada Acumulada' }
];

const CATEGORIAS = [
  { value: 'MEDICO_GENERAL', label: 'Médico General' },
  { value: 'MEDICO_ESPECIALISTA', label: 'Médico Especialista' },
  { value: 'MEDICO_FAMILIAR', label: 'Médico Familiar' },
  { value: 'RESIDENTE', label: 'Residente' },
  { value: 'INTERNO', label: 'Interno' }
];

export default function DoctorPortal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [activeTab, setActiveTab] = useState('profile');

  // Form states
  const [profileForm, setProfileForm] = useState({
    bio: '',
    experience: 0,
    consultationFee: 0,
    specialtyId: '',
    cedulaProfesional: '',
    numeroIMSS: '',
    hospitalAdscripcion: '',
    turno: '',
    categoria: ''
  });

  const [availabilityForm, setAvailabilityForm] = useState<{
    [key: number]: { startTime: string; endTime: string; isActive: boolean }
  }>({});

  const loadData = useCallback(async () => {
    try {
      const [profileRes, specialtiesRes, availabilityRes] = await Promise.all([
        fetch('/api/doctor/profile'),
        fetch('/api/specialties'),
        fetch('/api/doctor/availability')
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData.doctor);
        setProfileForm({
          bio: profileData.doctor.bio || '',
          experience: profileData.doctor.experience || 0,
          consultationFee: profileData.doctor.consultationFee || 0,
          specialtyId: profileData.doctor.specialty?.id || '',
          cedulaProfesional: profileData.doctor.cedulaProfesional || '',
          numeroIMSS: profileData.doctor.numeroIMSS || '',
          hospitalAdscripcion: profileData.doctor.hospitalAdscripcion || '',
          turno: profileData.doctor.turno || '',
          categoria: profileData.doctor.categoria || ''
        });
      }

      if (specialtiesRes.ok) {
        const specialtiesData = await specialtiesRes.json();
        setSpecialties(specialtiesData.specialties);
      }

      if (availabilityRes.ok) {
        const availabilityData = await availabilityRes.json();

        
        // Initialize availability form
        const formData: { [key: number]: { startTime: string; endTime: string; isActive: boolean } } = {};
        for (let i = 0; i < 7; i++) {
          const dayAvailability = availabilityData.availability.find((a: Availability) => a.dayOfWeek === i);
          formData[i] = {
            startTime: dayAvailability?.startTime || '09:00',
            endTime: dayAvailability?.endTime || '17:00',
            isActive: dayAvailability?.isActive || false
          };
        }
        setAvailabilityForm(formData);
      }
    } catch (_error) {
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'DOCTOR') {
      router.push('/auth/signin');
      return;
    }

    loadData();
  }, [session, status, router, loadData]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/doctor/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileForm)
      });

      if (response.ok) {
        toast.success('Perfil actualizado correctamente');
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al actualizar el perfil');
      }
    } catch (_error) {
      toast.error('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleAvailabilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const availabilityData = Object.entries(availabilityForm).map(([day, data]) => ({
        dayOfWeek: parseInt(day),
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: data.isActive
      }));

      const response = await fetch('/api/doctor/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ availability: availabilityData })
      });

      if (response.ok) {
        toast.success('Disponibilidad actualizada correctamente');
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al actualizar la disponibilidad');
      }
    } catch (_error) {
      toast.error('Error al actualizar la disponibilidad');
    } finally {
      setSaving(false);
    }
  };

  const isIMSSComplete = profile && 
    profile.cedulaProfesional && 
    profile.numeroIMSS && 
    profile.hospitalAdscripcion;

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
        <h1 className="text-3xl font-bold text-gray-900">Portal del Doctor</h1>
        <p className="text-gray-600 mt-2">Gestiona tu perfil, disponibilidad y consultas</p>
      </div>

      {/* Profile Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Consultas Totales</p>
                <p className="text-2xl font-bold text-gray-900">{profile?._count.appointments || 0}</p>
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
                <p className="text-2xl font-bold text-gray-900">{profile?._count.chatRooms || 0}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Video Sesiones</p>
                <p className="text-2xl font-bold text-gray-900">{profile?._count.videoSessions || 0}</p>
              </div>
              <Video className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Calificación</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-gray-900">{profile?.rating.toFixed(1) || '0.0'}</p>
                  <Star className="h-5 w-5 text-yellow-500 ml-1" />
                </div>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IMSS Status Alert */}
      {!isIMSSComplete && (
        <Card className="mb-8 border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-orange-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-orange-800">Completa tu perfil IMSS</h3>
                <p className="text-orange-700">Para poder recibir consultas, necesitas completar tu información del IMSS.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Disponibilidad
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Profile */}
            <Card>
              <CardHeader>
                <CardTitle>Información Básica</CardTitle>
                <CardDescription>Actualiza tu información profesional</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="specialty">Especialidad</Label>
                    <Select
                      value={profileForm.specialtyId}
                      onValueChange={(value) => setProfileForm(prev => ({ ...prev, specialtyId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una especialidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((specialty) => (
                          <SelectItem key={specialty.id} value={specialty.id}>
                            {specialty.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="bio">Biografía</Label>
                    <Textarea
                      id="bio"
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Describe tu experiencia y especialización..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="experience">Años de Experiencia</Label>
                      <Input
                        id="experience"
                        type="number"
                        min="0"
                        value={profileForm.experience}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, experience: parseInt(e.target.value) || 0 }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="consultationFee">Tarifa de Consulta ($)</Label>
                      <Input
                        id="consultationFee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={profileForm.consultationFee}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, consultationFee: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={saving} className="w-full">
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                    <Save className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* IMSS Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Información IMSS
                  {isIMSSComplete ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completo
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Incompleto
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Información requerida para el IMSS</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="cedulaProfesional">Cédula Profesional *</Label>
                    <Input
                      id="cedulaProfesional"
                      value={profileForm.cedulaProfesional}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, cedulaProfesional: e.target.value }))}
                      placeholder="Número de cédula profesional"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="numeroIMSS">Número IMSS *</Label>
                    <Input
                      id="numeroIMSS"
                      value={profileForm.numeroIMSS}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, numeroIMSS: e.target.value }))}
                      placeholder="Número de empleado IMSS"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="hospitalAdscripcion">Hospital de Adscripción *</Label>
                    <Input
                      id="hospitalAdscripcion"
                      value={profileForm.hospitalAdscripcion}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, hospitalAdscripcion: e.target.value }))}
                      placeholder="Nombre del hospital"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="turno">Turno</Label>
                    <Select
                      value={profileForm.turno}
                      onValueChange={(value) => setProfileForm(prev => ({ ...prev, turno: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tu turno" />
                      </SelectTrigger>
                      <SelectContent>
                        {TURNOS.map((turno) => (
                          <SelectItem key={turno.value} value={turno.value}>
                            {turno.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="categoria">Categoría</Label>
                    <Select
                      value={profileForm.categoria}
                      onValueChange={(value) => setProfileForm(prev => ({ ...prev, categoria: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tu categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((categoria) => (
                          <SelectItem key={categoria.value} value={categoria.value}>
                            {categoria.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={saving} className="w-full">
                    {saving ? 'Guardando...' : 'Guardar Información IMSS'}
                    <Save className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>Horarios de Disponibilidad</CardTitle>
              <CardDescription>Configura tus horarios de atención para cada día de la semana</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAvailabilitySubmit} className="space-y-6">
                {DAYS_OF_WEEK.map((day, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="w-24">
                      <Label className="font-medium">{day}</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={availabilityForm[index]?.isActive || false}
                        onChange={(e) => setAvailabilityForm(prev => ({
                          ...prev,
                          [index]: {
                            ...prev[index],
                            isActive: e.target.checked
                          }
                        }))}
                        className="rounded"
                      />
                      <Label className="text-sm">Disponible</Label>
                    </div>

                    {availabilityForm[index]?.isActive && (
                      <>
                        <div>
                          <Label className="text-sm">Desde</Label>
                          <Input
                            type="time"
                            value={availabilityForm[index]?.startTime || '09:00'}
                            onChange={(e) => setAvailabilityForm(prev => ({
                              ...prev,
                              [index]: {
                                ...prev[index],
                                startTime: e.target.value
                              }
                            }))}
                            className="w-32"
                          />
                        </div>

                        <div>
                          <Label className="text-sm">Hasta</Label>
                          <Input
                            type="time"
                            value={availabilityForm[index]?.endTime || '17:00'}
                            onChange={(e) => setAvailabilityForm(prev => ({
                              ...prev,
                              [index]: {
                                ...prev[index],
                                endTime: e.target.value
                              }
                            }))}
                            className="w-32"
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? 'Guardando...' : 'Guardar Disponibilidad'}
                  <Save className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
                <CardDescription>Accede a las funciones principales</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => router.push('/chat')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Ir a Chat
                </Button>
                
                <Button 
                  onClick={() => router.push('/appointments')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Ver Citas
                </Button>
                
                <Button 
                  onClick={() => router.push('/doctor/earnings')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Ver Ganancias
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estado de la Cuenta</CardTitle>
                <CardDescription>Información sobre tu cuenta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Estado de la cuenta:</span>
                  <Badge variant={profile?.isActive ? 'default' : 'destructive'}>
                    {profile?.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Perfil IMSS:</span>
                  <Badge variant={isIMSSComplete ? 'default' : 'destructive'}>
                    {isIMSSComplete ? 'Completo' : 'Incompleto'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Especialidad:</span>
                  <span className="text-sm text-gray-600">
                    {profile?.specialty?.name || 'No asignada'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}