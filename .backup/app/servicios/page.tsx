import { Metadata } from 'next';
import { 
  Video, 
  Clock, 
  Shield, 
  Heart, 
  Stethoscope, 
  Brain, 
  Baby, 
  Users, 
  Pill,
  FileText,
  Phone,
  Calendar,
  CheckCircle,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Servicios Médicos - Medica Movil',
  description: 'Consultas médicas en línea, especialistas certificados, recetas digitales y más. Atención médica de calidad desde tu casa.',
};

export default function ServiciosPage() {
  const serviciosPrincipales = [
    {
      icon: Video,
      title: 'Consultas Virtuales',
      description: 'Consultas médicas por videollamada con doctores certificados',
      precio: 'Desde $299 MXN',
      caracteristicas: [
        'Videoconsulta HD en tiempo real',
        'Historial médico digital',
        'Receta médica electrónica',
        'Disponible 24/7'
      ],
      popular: true
    },
    {
      icon: Phone,
      title: 'Consulta Telefónica',
      description: 'Orientación médica inmediata por teléfono',
      precio: 'Desde $199 MXN',
      caracteristicas: [
        'Respuesta inmediata',
        'Orientación médica profesional',
        'Seguimiento por WhatsApp',
        'Ideal para urgencias menores'
      ]
    },
    {
      icon: FileText,
      title: 'Segunda Opinión',
      description: 'Obtén una segunda opinión médica de especialistas',
      precio: 'Desde $499 MXN',
      caracteristicas: [
        'Revisión de estudios médicos',
        'Análisis de diagnósticos',
        'Recomendaciones especializadas',
        'Informe médico detallado'
      ]
    },
    {
      icon: Calendar,
      title: 'Seguimiento Continuo',
      description: 'Monitoreo médico regular para enfermedades crónicas',
      precio: 'Desde $899 MXN/mes',
      caracteristicas: [
        'Consultas programadas',
        'Monitoreo de signos vitales',
        'Ajuste de medicamentos',
        'Plan de cuidados personalizado'
      ]
    }
  ];

  const especialidades = [
    {
      icon: Heart,
      nombre: 'Cardiología',
      descripcion: 'Especialistas en enfermedades del corazón y sistema cardiovascular',
      doctores: '45+ doctores'
    },
    {
      icon: Brain,
      nombre: 'Neurología',
      descripcion: 'Atención especializada para el sistema nervioso',
      doctores: '32+ doctores'
    },
    {
      icon: Baby,
      nombre: 'Pediatría',
      descripcion: 'Cuidado médico especializado para niños y adolescentes',
      doctores: '58+ doctores'
    },
    {
      icon: Users,
      nombre: 'Medicina General',
      descripcion: 'Atención médica integral para toda la familia',
      doctores: '120+ doctores'
    },
    {
      icon: Stethoscope,
      nombre: 'Medicina Interna',
      descripcion: 'Diagnóstico y tratamiento de enfermedades en adultos',
      doctores: '67+ doctores'
    },
    {
      icon: Pill,
      nombre: 'Psiquiatría',
      descripcion: 'Salud mental y trastornos psiquiátricos',
      doctores: '28+ doctores'
    }
  ];

  const ventajas = [
    {
      icon: Clock,
      title: 'Disponibilidad 24/7',
      description: 'Atención médica cuando la necesites, todos los días del año'
    },
    {
      icon: Shield,
      title: 'Doctores Certificados',
      description: 'Todos nuestros médicos están certificados por el Consejo Mexicano'
    },
    {
      icon: FileText,
      title: 'Recetas Digitales',
      description: 'Recetas médicas válidas que puedes usar en cualquier farmacia'
    },
    {
      icon: Heart,
      title: 'Seguimiento Personalizado',
      description: 'Historial médico digital y seguimiento continuo de tu salud'
    }
  ];

  const planes = [
    {
      nombre: 'Básico',
      precio: '199',
      periodo: 'por consulta',
      descripcion: 'Ideal para consultas ocasionales',
      caracteristicas: [
        'Consulta telefónica',
        'Orientación médica',
        'Seguimiento por WhatsApp',
        'Soporte básico'
      ],
      popular: false
    },
    {
      nombre: 'Premium',
      precio: '299',
      periodo: 'por consulta',
      descripcion: 'La opción más popular',
      caracteristicas: [
        'Videoconsulta HD',
        'Receta médica digital',
        'Historial médico',
        'Disponible 24/7',
        'Soporte prioritario'
      ],
      popular: true
    },
    {
      nombre: 'Familiar',
      precio: '999',
      periodo: 'mensual',
      descripcion: 'Para toda la familia',
      caracteristicas: [
        'Hasta 5 miembros',
        'Consultas ilimitadas',
        'Seguimiento continuo',
        'Descuentos en especialistas',
        'Soporte VIP'
      ],
      popular: false
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 to-blue-50 py-20">
        <div className="max-width-container">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4">
              Servicios Médicos Certificados
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Atención Médica de <span className="text-primary">Calidad</span> desde tu Casa
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Consultas médicas virtuales con doctores certificados, recetas digitales válidas 
              y seguimiento personalizado. La salud que necesitas, cuando la necesitas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/buscar">
                <Button size="lg" className="w-full sm:w-auto">
                  Buscar Doctor Ahora
                </Button>
              </Link>
              <Link href="/registrarse">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Registrarse Gratis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Servicios Principales */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Nuestros Servicios
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Ofrecemos una gama completa de servicios médicos digitales para cuidar tu salud y la de tu familia
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {serviciosPrincipales.map((servicio, index) => (
              <Card key={index} className={`relative hover:shadow-lg transition-all ${servicio.popular ? 'ring-2 ring-primary' : ''}`}>
                {servicio.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                    Más Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <servicio.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle className="text-lg">{servicio.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{servicio.description}</p>
                  <div className="text-2xl font-bold text-primary">{servicio.precio}</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {servicio.caracteristicas.map((caracteristica, idx) => (
                      <li key={idx} className="flex items-center text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                        {caracteristica}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Especialidades */}
      <section className="py-20 bg-muted/30">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Especialidades Médicas
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Contamos con especialistas certificados en las principales áreas de la medicina
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {especialidades.map((especialidad, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <especialidad.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-2">
                        {especialidad.nombre}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {especialidad.descripcion}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {especialidad.doctores}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Ventajas */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              ¿Por qué Elegir Medica Movil?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Ventajas que nos convierten en la opción preferida para la atención médica digital en México
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {ventajas.map((ventaja, index) => (
              <div key={index} className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ventaja.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  {ventaja.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {ventaja.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes de Precios */}
      <section className="py-20 bg-muted/30">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Planes y Precios
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Elige el plan que mejor se adapte a tus necesidades de salud
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {planes.map((plan, index) => (
              <Card key={index} className={`relative hover:shadow-lg transition-all ${plan.popular ? 'ring-2 ring-primary scale-105' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Star className="h-3 w-3 mr-1" />
                    Más Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.nombre}</CardTitle>
                  <div className="text-3xl font-bold text-primary">
                    ${plan.precio}
                    <span className="text-sm text-muted-foreground font-normal">
                      {plan.periodo}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.descripcion}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.caracteristicas.map((caracteristica, idx) => (
                      <li key={idx} className="flex items-center text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                        {caracteristica}
                      </li>
                    ))}
                  </ul>
                  <Link href="/registrarse">
                    <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                      Comenzar Ahora
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="bg-gradient-to-r from-primary/10 to-blue-50 rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              ¿Listo para Cuidar tu Salud?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Únete a miles de mexicanos que ya confían en Medica Movil para su atención médica
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/buscar">
                <Button size="lg" className="w-full sm:w-auto">
                  Buscar Doctor Ahora
                </Button>
              </Link>
              <Link href="/doctor/registro">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Soy Doctor - Únete
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
} 
