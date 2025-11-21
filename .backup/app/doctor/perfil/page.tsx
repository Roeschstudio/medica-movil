'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { User, Mail, Phone, MapPin, Calendar, Save, Edit, Camera, Star, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface Schedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface ConsultationTypes {
  presencial: boolean;
  virtual: boolean;
  domicilio: boolean;
}

interface Prices {
  presencial: string;
  virtual: string;
  domicilio: string;
}

interface DoctorProfile {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  licenseNumber: string;
  university: string;
  graduationYear: string;
  experience: string;
  bio: string;
  address: string;
  consultationTypes: ConsultationTypes;
  prices: Prices;
  schedule: Schedule;
}

type DayKey = keyof Schedule;
type ProfileKey = keyof DoctorProfile;
type ConsultationKey = keyof ConsultationTypes;
type PriceKey = keyof Prices;

export default function DoctorProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<DoctorProfile>({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    licenseNumber: '',
    university: '',
    graduationYear: '',
    experience: '',
    bio: '',
    address: '',
    consultationTypes: {
      presencial: true,
      virtual: false,
      domicilio: false
    },
    prices: {
      presencial: '',
      virtual: '',
      domicilio: ''
    },
    schedule: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '13:00' },
      sunday: { enabled: false, start: '09:00', end: '13:00' }
    }
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'DOCTOR') {
      router.push('/unauthorized');
      return;
    }

    loadProfile();
  }, [session, status, router]);

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(prev => ({
          ...prev,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          specialty: data.specialty || '',
          licenseNumber: data.licenseNumber || '',
          university: data.university || '',
          graduationYear: data.graduationYear || '',
          experience: data.experience || '',
          bio: data.bio || '',
          address: data.address || '',
          consultationTypes: data.consultationTypes || prev.consultationTypes,
          prices: data.prices || prev.prices,
          schedule: data.schedule || prev.schedule
        }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Error al cargar el perfil');
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });

      if (response.ok) {
        toast.success('Perfil actualizado correctamente');
        setIsEditing(false);
      } else {
        throw new Error('Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error al guardar los cambios');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: ProfileKey, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent: 'consultationTypes' | 'prices', field: string, value: any) => {
    setProfile(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleScheduleChange = (day: DayKey, field: keyof DaySchedule, value: boolean | string) => {
    setProfile(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          [field]: value
        }
      }
    }));
  };

  const days: Array<{ key: DayKey; label: string }> = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
  ];

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mi Perfil Profesional</h1>
              <p className="text-gray-600 mt-2">Gestiona tu información profesional y configuración</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="px-3 py-1">
                Doctor
              </Badge>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} className="flex items-center space-x-2">
                  <Edit className="h-4 w-4" />
                  <span>Editar</span>
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading} className="flex items-center space-x-2">
                    <Save className="h-4 w-4" />
                    <span>{isLoading ? 'Guardando...' : 'Guardar'}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Contenido principal */}
          <div className="lg:col-span-3 space-y-6">
            {/* Información Personal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Información Personal</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="specialty">Especialidad</Label>
                    <Input
                      id="specialty"
                      value={profile.specialty}
                      onChange={(e) => handleInputChange('specialty', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Dirección del consultorio</Label>
                  <Textarea
                    id="address"
                    value={profile.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Dirección completa del consultorio"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Información Profesional */}
            <Card>
              <CardHeader>
                <CardTitle>Información Profesional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="licenseNumber">Número de cédula</Label>
                    <Input
                      id="licenseNumber"
                      value={profile.licenseNumber}
                      onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="university">Universidad</Label>
                    <Input
                      id="university"
                      value={profile.university}
                      onChange={(e) => handleInputChange('university', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="graduationYear">Año de graduación</Label>
                    <Input
                      id="graduationYear"
                      value={profile.graduationYear}
                      onChange={(e) => handleInputChange('graduationYear', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="experience">Años de experiencia</Label>
                    <Input
                      id="experience"
                      value={profile.experience}
                      onChange={(e) => handleInputChange('experience', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="bio">Biografía profesional</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Describe tu experiencia, especialidades y enfoque médico"
                    className="min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tipos de consulta y precios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Servicios y Precios</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Consulta Presencial</Label>
                      <Switch
                        checked={profile.consultationTypes.presencial}
                        onCheckedChange={(checked) => 
                          handleNestedChange('consultationTypes', 'presencial', checked)
                        }
                        disabled={!isEditing}
                      />
                    </div>
                    {profile.consultationTypes.presencial && (
                      <Input
                        placeholder="Precio en MXN"
                        value={profile.prices.presencial}
                        onChange={(e) => handleNestedChange('prices', 'presencial', e.target.value)}
                        disabled={!isEditing}
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Consulta Virtual</Label>
                      <Switch
                        checked={profile.consultationTypes.virtual}
                        onCheckedChange={(checked) => 
                          handleNestedChange('consultationTypes', 'virtual', checked)
                        }
                        disabled={!isEditing}
                      />
                    </div>
                    {profile.consultationTypes.virtual && (
                      <Input
                        placeholder="Precio en MXN"
                        value={profile.prices.virtual}
                        onChange={(e) => handleNestedChange('prices', 'virtual', e.target.value)}
                        disabled={!isEditing}
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Consulta a Domicilio</Label>
                      <Switch
                        checked={profile.consultationTypes.domicilio}
                        onCheckedChange={(checked) => 
                          handleNestedChange('consultationTypes', 'domicilio', checked)
                        }
                        disabled={!isEditing}
                      />
                    </div>
                    {profile.consultationTypes.domicilio && (
                      <Input
                        placeholder="Precio en MXN"
                        value={profile.prices.domicilio}
                        onChange={(e) => handleNestedChange('prices', 'domicilio', e.target.value)}
                        disabled={!isEditing}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Horarios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Horarios de Atención</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {days.map((day) => (
                    <div key={day.key} className="flex items-center space-x-4">
                      <div className="w-20">
                        <Switch
                          checked={profile.schedule[day.key].enabled}
                          onCheckedChange={(checked) => 
                            handleScheduleChange(day.key, 'enabled', checked)
                          }
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="w-24 text-sm font-medium">{day.label}</div>
                      {profile.schedule[day.key].enabled && (
                        <div className="flex items-center space-x-2">
                          <Input
                            type="time"
                            value={profile.schedule[day.key].start}
                            onChange={(e) => 
                              handleScheduleChange(day.key, 'start', e.target.value)
                            }
                            disabled={!isEditing}
                            className="w-32"
                          />
                          <span className="text-gray-500">a</span>
                          <Input
                            type="time"
                            value={profile.schedule[day.key].end}
                            onChange={(e) => 
                              handleScheduleChange(day.key, 'end', e.target.value)
                            }
                            disabled={!isEditing}
                            className="w-32"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Avatar y datos básicos */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-2xl">
                        {profile.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <Button size="sm" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0">
                        <Camera className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Dr. {profile.name}</h3>
                    <p className="text-gray-600">{profile.specialty}</p>
                    <p className="text-sm text-gray-500">{profile.email}</p>
                  </div>
                  <Badge variant="secondary">Doctor Verificado</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Estadísticas */}
            <Card>
              <CardHeader>
                <CardTitle>Mis Estadísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Calificación</span>
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="font-semibold">4.8</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Pacientes atendidos</span>
                  <span className="font-semibold">247</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Citas este mes</span>
                  <span className="font-semibold">32</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Próxima cita</span>
                  <span className="font-semibold text-primary">Hoy 3:00 PM</span>
                </div>
              </CardContent>
            </Card>

            {/* Acciones rápidas */}
            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Ver mi agenda
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Star className="h-4 w-4 mr-2" />
                  Ver reseñas
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Configurar precios
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 
