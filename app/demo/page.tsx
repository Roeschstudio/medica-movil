'use client';

import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, User, Shield, Stethoscope, Eye, LogIn } from 'lucide-react';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Demo - Cuentas de Prueba | Medica Móvil',
  description: 'Prueba nuestra plataforma con cuentas de demostración. Explora las funcionalidades como admin, doctor o paciente.',
};

export default function DemoPage() {
  const cuentasPrueba = [
    {
      tipo: 'Administrador',
      email: 'john@doe.com',
      password: 'johndoe123',
      descripcion: 'Acceso completo al panel administrativo',
      icon: <Shield className="h-8 w-8 text-red-600" />,
      color: 'bg-red-50 border-red-200',
      features: [
        'Dashboard de administración',
        'Gestión de usuarios',
        'Estadísticas del sistema',
        'Configuración de la plataforma'
      ]
    },
    {
      tipo: 'Doctor',
      email: 'dra.sofia.martinez@medico.com',
      password: 'doctor123',
      descripción: 'Perfil de médico especialista verificado',
      icon: <Stethoscope className="h-8 w-8 text-blue-600" />,
      color: 'bg-blue-50 border-blue-200',
      features: [
        'Agenda de citas médicas',
        'Perfil profesional',
        'Configuración de horarios',
        'Gestión de consultas'
      ]
    },
    {
      tipo: 'Paciente',
      email: 'maria.garcia@email.com',
      password: 'paciente123',
      descripción: 'Cuenta de paciente con historial médico',
      icon: <User className="h-8 w-8 text-green-600" />,
      color: 'bg-green-50 border-green-200',
      features: [
        'Búsqueda de doctores',
        'Agendado de citas',
        'Historial médico',
        'Perfil de paciente'
      ]
    }
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-white">
      <MainNav />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <Badge className="mb-6 bg-white/20 text-white border-white/30">
              <Eye className="mr-2 h-4 w-4" />
              Modo Demostración
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Prueba Medica Móvil
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-blue-100">
              Explora todas las funcionalidades de nuestra plataforma con cuentas de demostración. 
              Prueba diferentes roles y descubre cómo funciona el sistema.
            </p>
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
              <Link href="/iniciar-sesion">
                <LogIn className="mr-2 h-5 w-5" />
                Iniciar Sesión
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Cuentas de Prueba */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Cuentas de Demostración
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Utiliza estas credenciales para explorar la plataforma desde diferentes perspectivas
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {cuentasPrueba.map((cuenta, index) => (
              <Card key={index} className={`hover:shadow-xl transition-all duration-300 ${cuenta.color} border-2`}>
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      {cuenta.icon}
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {cuenta.tipo}
                  </CardTitle>
                  <CardDescription className="text-gray-700">
                    {cuenta.descripción}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Credenciales */}
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email:</label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 bg-gray-50 px-2 py-1 rounded text-sm">
                            {cuenta.email}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(cuenta.email)}
                            className="p-2"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-600">Contraseña:</label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 bg-gray-50 px-2 py-1 rounded text-sm">
                            {cuenta.password}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(cuenta.password)}
                            className="p-2"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Funcionalidades */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Funcionalidades disponibles:</h4>
                    <ul className="space-y-2">
                      {cuenta.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Botón de acceso */}
                  <Button asChild className="w-full mt-4">
                    <Link href="/iniciar-sesion">
                      Probar como {cuenta.tipo}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              ¿Cómo usar las cuentas de prueba?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-white">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Elige un Rol</h3>
              <p className="text-gray-600">
                Selecciona qué tipo de usuario quieres probar: Admin, Doctor o Paciente.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-white">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Copia las Credenciales</h3>
              <p className="text-gray-600">
                Usa el botón de copiar para obtener el email y contraseña de la cuenta de prueba.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-white">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Inicia Sesión</h3>
              <p className="text-gray-600">
                Ve a la página de inicio de sesión e ingresa las credenciales para explorar.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">
            ¿Listo para crear tu cuenta real?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Después de probar la plataforma, registra tu cuenta real y comienza a usar Medica Móvil
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
              <Link href="/registrarse">
                Registrarse como Paciente
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
              <Link href="/doctor/registro">
                Registrarse como Doctor
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
} 