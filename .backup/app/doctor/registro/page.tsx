'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Heart, Stethoscope, Mail, Lock, Eye, EyeOff, AlertCircle, User, Phone, MapPin, FileText, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DoctorRegistrationPage() {
  const [formData, setFormData] = useState({
    // Datos personales
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    
    // Datos profesionales
    licenseNumber: '',
    specialty: '',
    bio: '',
    
    // Ubicación
    address: '',
    city: '',
    state: '',
    zipCode: '',
    
    // Configuración de consultas
    acceptsInPerson: true,
    acceptsVirtual: false,
    acceptsHomeVisits: false,
    
    // Precios (en pesos MXN)
    priceInPerson: '',
    priceVirtual: '',
    priceHomeVisit: '',
    
    // Configuración especial
    firstConsultationFree: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const { toast } = useToast();

  const specialties = [
    'Medicina General',
    'Cardiología',
    'Dermatología',
    'Ginecología',
    'Pediatría',
    'Neurología',
    'Oftalmología',
    'Traumatología',
    'Psiquiatría',
    'Endocrinología',
    'Urología',
    'Otorrinolaringología',
    'Gastroenterología',
    'Neumología',
    'Reumatología'
  ];

  const mexicanStates = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
    'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
    'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
    'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
    'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
    'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validaciones básicas
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    try {
      // Convertir precios a centavos
      const priceInPersonCents = formData.priceInPerson ? Math.round(parseFloat(formData.priceInPerson) * 100) : null;
      const priceVirtualCents = formData.priceVirtual ? Math.round(parseFloat(formData.priceVirtual) * 100) : null;
      const priceHomeVisitCents = formData.priceHomeVisit ? Math.round(parseFloat(formData.priceHomeVisit) * 100) : null;

      const registrationData = {
        // Datos del usuario
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role: 'DOCTOR',
        
        // Datos del doctor
        doctorData: {
          licenseNumber: formData.licenseNumber,
          specialty: formData.specialty,
          bio: formData.bio,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          acceptsInPerson: formData.acceptsInPerson,
          acceptsVirtual: formData.acceptsVirtual,
          acceptsHomeVisits: formData.acceptsHomeVisits,
          priceInPerson: priceInPersonCents,
          priceVirtual: priceVirtualCents,
          priceHomeVisit: priceHomeVisitCents,
          firstConsultationFree: formData.firstConsultationFree,
        }
      };

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al registrar doctor');
      }

      toast({
        title: "¡Registro exitoso!",
        description: "Tu cuenta ha sido creada. Serás verificado pronto.",
      });

      router.push('/iniciar-sesion?message=registro-exitoso');

    } catch (error: any) {
      console.error('Error during registration:', error);
      setError(error.message || 'Error inesperado. Por favor, intenta de nuevo.');
      toast({
        title: "Error en el registro",
        description: error.message || "Error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      <div className="flex-1 bg-muted/30 py-12">
        <div className="max-width-container">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center space-y-4">
              <Link href="/" className="inline-flex items-center space-x-2 mb-6">
                <Heart className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold text-foreground">
                  Medica <span className="text-primary">Movil</span>
                </span>
              </Link>
              <h1 className="text-3xl font-bold text-foreground">
                Registro de Doctores
              </h1>
              <p className="text-muted-foreground text-lg">
                Únete a nuestra plataforma y conecta con pacientes en todo México
              </p>
            </div>

            <Card className="medical-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  <span>Información Profesional</span>
                </CardTitle>
                <CardDescription>
                  Completa tu perfil médico para comenzar a recibir pacientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Datos Personales */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>Datos Personales</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre Completo *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Dr. Juan Pérez González"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="doctor@email.com"
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder="+52 55 1234 5678"
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="licenseNumber">Cédula Profesional *</Label>
                        <Input
                          id="licenseNumber"
                          value={formData.licenseNumber}
                          onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                          placeholder="12345678"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password">Contraseña *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="pl-10 pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            placeholder="Repite tu contraseña"
                            className="pl-10 pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Datos Profesionales */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                      <Stethoscope className="h-5 w-5" />
                      <span>Información Profesional</span>
                    </h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Especialidad *</Label>
                      <Select value={formData.specialty} onValueChange={(value) => handleInputChange('specialty', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tu especialidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {specialties.map((specialty) => (
                            <SelectItem key={specialty} value={specialty}>
                              {specialty}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="bio">Biografía Profesional</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        placeholder="Describe tu experiencia, especialidades y enfoque médico..."
                        rows={4}
                      />
                    </div>
                  </div>

                  {/* Ubicación */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                      <MapPin className="h-5 w-5" />
                      <span>Ubicación del Consultorio</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="address">Dirección *</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          placeholder="Av. Insurgentes Sur 123, Col. Roma Norte"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="city">Ciudad *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          placeholder="Ciudad de México"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="state">Estado *</Label>
                        <Select value={formData.state} onValueChange={(value) => handleInputChange('state', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tu estado" />
                          </SelectTrigger>
                          <SelectContent>
                            {mexicanStates.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">Código Postal</Label>
                        <Input
                          id="zipCode"
                          value={formData.zipCode}
                          onChange={(e) => handleInputChange('zipCode', e.target.value)}
                          placeholder="06700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Precios */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                      <DollarSign className="h-5 w-5" />
                      <span>Configuración de Precios (MXN)</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="priceInPerson">Consulta Presencial</Label>
                        <Input
                          id="priceInPerson"
                          type="number"
                          value={formData.priceInPerson}
                          onChange={(e) => handleInputChange('priceInPerson', e.target.value)}
                          placeholder="800"
                          min="0"
                          step="50"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="priceVirtual">Consulta Virtual</Label>
                        <Input
                          id="priceVirtual"
                          type="number"
                          value={formData.priceVirtual}
                          onChange={(e) => handleInputChange('priceVirtual', e.target.value)}
                          placeholder="600"
                          min="0"
                          step="50"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="priceHomeVisit">Visita Domiciliaria</Label>
                        <Input
                          id="priceHomeVisit"
                          type="number"
                          value={formData.priceHomeVisit}
                          onChange={(e) => handleInputChange('priceHomeVisit', e.target.value)}
                          placeholder="1200"
                          min="0"
                          step="50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-6">
                    <Button 
                      type="submit" 
                      className="flex-1" 
                      size="lg"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Registrando...' : 'Registrar como Doctor'}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="lg"
                      onClick={() => router.push('/')}
                    >
                      Cancelar
                    </Button>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">
                    ¿Ya tienes una cuenta?{' '}
                    <Link href="/iniciar-sesion" className="text-primary hover:underline font-medium">
                      Inicia sesión aquí
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
} 
