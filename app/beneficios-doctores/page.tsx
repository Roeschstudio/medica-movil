import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Users, Calendar, CreditCard, TrendingUp, Shield, Clock, Star } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Beneficios para Doctores | Medica Móvil',
  description: 'Descubre todos los beneficios de unirte a nuestra plataforma como profesional de la salud',
};

export default function BeneficiosDoctoresPage() {
  const beneficios = [
    {
      icon: <Users className="h-8 w-8 text-blue-600" />,
      titulo: "Amplía tu Base de Pacientes",
      descripcion: "Conecta con miles de pacientes que buscan atención médica de calidad en tu área de especialización.",
      detalles: ["Exposición a nuevos pacientes", "Perfil profesional destacado", "Reseñas y calificaciones"]
    },
    {
      icon: <Calendar className="h-8 w-8 text-green-600" />,
      titulo: "Gestión Inteligente de Citas",
      descripcion: "Sistema automatizado que te permite gestionar tu agenda de manera eficiente y sin complicaciones.",
      detalles: ["Calendario integrado", "Recordatorios automáticos", "Reprogramación fácil"]
    },
    {
      icon: <CreditCard className="h-8 w-8 text-purple-600" />,
      titulo: "Pagos Seguros y Automáticos",
      descripcion: "Recibe tus pagos de forma segura y puntual a través de nuestra plataforma integrada.",
      detalles: ["Pagos automáticos", "Múltiples métodos de pago", "Transferencias seguras"]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Transforma tu Práctica Médica
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
              Únete a la plataforma líder en telemedicina y lleva tu carrera al siguiente nivel
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                <Link href="/doctor/registro">
                  Registrarse Ahora
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                <Link href="/iniciar-sesion">
                  Ya tengo cuenta
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Beneficios */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            ¿Por qué elegir Medica Móvil?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Descubre todas las ventajas que tenemos para ofrecerte como profesional de la salud
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {beneficios.map((beneficio, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  {beneficio.icon}
                  <div>
                    <CardTitle className="text-xl">{beneficio.titulo}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base mb-4">
                  {beneficio.descripcion}
                </CardDescription>
                <ul className="space-y-2">
                  {beneficio.detalles.map((detalle, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {detalle}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Final */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Listo para comenzar?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Únete a cientos de doctores que ya están creciendo con nuestra plataforma
          </p>
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
            <Link href="/doctor/registro">
              Registrarse Gratis
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 