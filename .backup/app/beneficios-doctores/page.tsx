import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Users, 
  Calendar, 
  CreditCard, 
  TrendingUp, 
  Shield, 
  Clock, 
  Star,
  Stethoscope,
  Globe,
  BarChart3,
  Smartphone,
  Award,
  Heart,
  Zap,
  DollarSign
} from 'lucide-react';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Beneficios para Doctores - Únete a la Revolución Digital | Medica Móvil',
  description: 'Descubre todos los beneficios de unirte a Medica Móvil como profesional de la salud. Amplía tu práctica, aumenta tus ingresos y ayuda a más pacientes.',
  keywords: 'beneficios doctores, telemedicina, consultas online, médicos digitales, plataforma médica',
};

export default function BeneficiosDoctoresPage() {
  const beneficiosPrincipales = [
    {
      icon: <Users className="h-12 w-12 text-blue-600" />,
      titulo: "Amplía tu Base de Pacientes",
      descripcion: "Conecta con miles de pacientes en toda la República Mexicana que buscan atención médica de calidad.",
      detalles: [
        "Acceso a 10,000+ pacientes activos",
        "Perfil profesional destacado",
        "Sistema de reseñas y calificaciones",
        "Posicionamiento por especialidad"
      ],
      color: "bg-blue-50 border-blue-200"
    },
    {
      icon: <Calendar className="h-12 w-12 text-green-600" />,
      titulo: "Gestión Inteligente de Agenda",
      descripcion: "Sistema automatizado que optimiza tu tiempo y reduce las cancelaciones de última hora.",
      detalles: [
        "Calendario integrado 24/7",
        "Recordatorios automáticos por SMS/Email",
        "Reprogramación fácil para pacientes",
        "Bloqueo de horarios personalizables"
      ],
      color: "bg-green-50 border-green-200"
    },
    {
      icon: <CreditCard className="h-12 w-12 text-purple-600" />,
      titulo: "Pagos Seguros y Puntuales",
      descripcion: "Recibe tus honorarios de forma automática y segura, sin preocuparte por la cobranza.",
      detalles: [
        "Pagos automáticos cada consulta",
        "Transferencias semanales a tu cuenta",
        "Múltiples métodos de pago",
        "Reportes financieros detallados"
      ],
      color: "bg-purple-50 border-purple-200"
    },
    {
      icon: <Shield className="h-12 w-12 text-red-600" />,
      titulo: "Seguridad y Respaldo Legal",
      descripcion: "Plataforma certificada que cumple con todas las normativas mexicanas de salud digital.",
      detalles: [
        "Certificación COFEPRIS",
        "Cumplimiento NOM-024-SSA3-2012",
        "Respaldo legal en consultas",
        "Protección de datos personales"
      ],
      color: "bg-red-50 border-red-200"
    },
    {
      icon: <TrendingUp className="h-12 w-12 text-orange-600" />,
      titulo: "Crecimiento Profesional",
      descripcion: "Herramientas para hacer crecer tu práctica y aumentar tus ingresos de manera sostenible.",
      detalles: [
        "Analytics de tu desempeño",
        "Programas de educación continua",
        "Networking con otros especialistas",
        "Oportunidades de especialización"
      ],
      color: "bg-orange-50 border-orange-200"
    },
    {
      icon: <Smartphone className="h-12 w-12 text-indigo-600" />,
      titulo: "Tecnología de Vanguardia",
      descripcion: "Plataforma moderna y fácil de usar, optimizada para consultas virtuales de alta calidad.",
      detalles: [
        "Videollamadas HD integradas",
        "Expediente médico digital",
        "Recetas electrónicas válidas",
        "App móvil para doctores"
      ],
      color: "bg-indigo-50 border-indigo-200"
    }
  ];

  const estadisticas = [
    { numero: "500+", texto: "Doctores Activos", icon: <Stethoscope className="h-8 w-8 text-blue-600" /> },
    { numero: "10,000+", texto: "Pacientes Atendidos", icon: <Heart className="h-8 w-8 text-red-600" /> },
    { numero: "32", texto: "Estados Cubiertos", icon: <Globe className="h-8 w-8 text-green-600" /> },
    { numero: "4.8/5", texto: "Calificación Promedio", icon: <Star className="h-8 w-8 text-yellow-600" /> }
  ];

  const tiposConsulta = [
    {
      tipo: "Consulta Virtual",
      precio: "$299 MXN",
      comision: "85% para ti",
      descripcion: "Videollamada con el paciente desde tu consultorio o casa"
    },
    {
      tipo: "Consulta Telefónica",
      precio: "$199 MXN",
      comision: "85% para ti",
      descripcion: "Llamada telefónica para consultas de seguimiento"
    },
    {
      tipo: "Segunda Opinión",
      precio: "$499 MXN",
      comision: "85% para ti",
      descripcion: "Revisión de casos complejos y segunda opinión médica"
    }
  ];

  const testimonios = [
    {
      nombre: "Dr. Carlos Mendoza",
      especialidad: "Cardiología",
      testimonio: "Medica Móvil me ha permitido llegar a pacientes que antes no podía atender. Mis ingresos han aumentado 40% en 6 meses.",
      rating: 5
    },
    {
      nombre: "Dra. Ana Ruiz",
      especialidad: "Pediatría",
      testimonio: "La plataforma es muy fácil de usar y los pagos son puntuales. Recomiendo Medica Móvil a todos mis colegas.",
      rating: 5
    },
    {
      nombre: "Dr. Miguel Torres",
      especialidad: "Medicina General",
      testimonio: "Excelente herramienta para consultas de seguimiento. Mis pacientes están muy satisfechos con el servicio.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <MainNav />
      
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <Badge className="mb-6 bg-white/20 text-white border-white/30">
              Para Profesionales de la Salud
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Transforma tu Práctica Médica
              <span className="block text-blue-200">con Tecnología Digital</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-4xl mx-auto text-blue-100">
              Únete a la plataforma líder en telemedicina en México. Amplía tu alcance, 
              aumenta tus ingresos y ayuda a más pacientes desde cualquier lugar.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold">
                <Link href="/doctor/registro">
                  <Award className="mr-2 h-5 w-5" />
                  Registrarse Gratis
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                <Link href="/iniciar-sesion">
                  Ya soy Doctor Registrado
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {estadisticas.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">
                  {stat.icon}
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  {stat.numero}
                </div>
                <div className="text-gray-600 font-medium">
                  {stat.texto}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Beneficios Principales */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              ¿Por qué elegir Medica Móvil?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Descubre todas las ventajas que tenemos para ofrecerte como profesional de la salud
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {beneficiosPrincipales.map((beneficio, index) => (
              <Card key={index} className={`hover:shadow-xl transition-all duration-300 ${beneficio.color} border-2`}>
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      {beneficio.icon}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-900 mb-2">
                        {beneficio.titulo}
                      </CardTitle>
                      <CardDescription className="text-gray-700 text-base">
                        {beneficio.descripcion}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {beneficio.detalles.map((detalle, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-700">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm font-medium">{detalle}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Tipos de Consulta y Comisiones */}
      <div className="py-20 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tipos de Consulta y Comisiones
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Gana hasta <span className="font-bold text-green-600">85% de cada consulta</span> con nuestro modelo transparente
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {tiposConsulta.map((consulta, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow bg-white border-2 border-gray-200">
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <DollarSign className="h-12 w-12 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {consulta.tipo}
                  </CardTitle>
                  <div className="text-3xl font-bold text-green-600 mt-2">
                    {consulta.precio}
                  </div>
                  <Badge className="bg-green-100 text-green-800 mt-2">
                    {consulta.comision}
                  </Badge>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-gray-600">
                    {consulta.descripcion}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonios */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Lo que dicen nuestros doctores
            </h2>
            <p className="text-xl text-gray-600">
              Testimonios reales de profesionales que ya forman parte de nuestra comunidad
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonios.map((testimonio, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Stethoscope className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{testimonio.nombre}</CardTitle>
                      <CardDescription>{testimonio.especialidad}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {[...Array(testimonio.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 italic">
                    "{testimonio.testimonio}"
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Proceso de Registro */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Proceso de Registro Simplificado
            </h2>
            <p className="text-xl text-gray-600">
              En solo 3 pasos estarás listo para comenzar a atender pacientes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Registro y Verificación</h3>
              <p className="text-gray-600">
                Completa tu perfil profesional y verifica tu cédula médica. Proceso 100% digital.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Configuración de Agenda</h3>
              <p className="text-gray-600">
                Define tus horarios de disponibilidad y tipos de consulta que ofreces.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">¡Comienza a Atender!</h3>
              <p className="text-gray-600">
                Recibe tu primera cita y comienza a generar ingresos adicionales.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Final */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            ¿Listo para Revolucionar tu Práctica Médica?
          </h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">
            Únete a cientos de doctores que ya están creciendo profesional y económicamente 
            con nuestra plataforma. El registro es <strong>completamente gratuito</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold">
              <Link href="/doctor/registro">
                <Zap className="mr-2 h-5 w-5" />
                Registrarse Gratis Ahora
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
              <Link href="/contacto">
                ¿Tienes Preguntas?
              </Link>
            </Button>
          </div>
          <p className="text-blue-200 mt-6 text-sm">
            * Sin costos de registro • Sin mensualidades • Solo comisión por consulta exitosa
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
} 
