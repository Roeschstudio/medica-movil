import { Metadata } from 'next';
import { Heart, Shield, Users, Stethoscope, Award, Clock, MapPin, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Sobre Nosotros - Medica Movil',
  description: 'Conoce la historia, misión y valores de Medica Movil, la plataforma líder en telemedicina en México.',
};

export default function SobreNosotrosPage() {
  const stats = [
    { number: '10,000+', label: 'Pacientes Atendidos' },
    { number: '500+', label: 'Doctores Certificados' },
    { number: '32', label: 'Estados de México' },
    { number: '24/7', label: 'Disponibilidad' },
  ];

  const valores = [
    {
      icon: Heart,
      title: 'Cuidado Humano',
      description: 'Ponemos a las personas en el centro de todo lo que hacemos, brindando atención médica con calidez y empatía.'
    },
    {
      icon: Shield,
      title: 'Seguridad y Privacidad',
      description: 'Protegemos tu información médica con los más altos estándares de seguridad y cumplimiento normativo.'
    },
    {
      icon: Users,
      title: 'Accesibilidad',
      description: 'Democratizamos el acceso a la salud de calidad en todo México, especialmente en comunidades remotas.'
    },
    {
      icon: Award,
      title: 'Excelencia Médica',
      description: 'Trabajamos solo con médicos certificados y especialistas reconocidos por el Consejo Mexicano de Especialidades.'
    }
  ];

  const equipo = [
    {
      nombre: 'Dr. Carlos Hernández',
      cargo: 'Director Médico',
      especialidad: 'Medicina Interna',
      cedula: 'Cédula: 4567890',
      imagen: '/api/placeholder/120/120'
    },
    {
      nombre: 'Dra. María González',
      cargo: 'Jefa de Telemedicina',
      especialidad: 'Cardiología',
      cedula: 'Cédula: 3456789',
      imagen: '/api/placeholder/120/120'
    },
    {
      nombre: 'Dr. Roberto Martínez',
      cargo: 'Coordinador de Emergencias',
      especialidad: 'Medicina de Urgencias',
      cedula: 'Cédula: 5678901',
      imagen: '/api/placeholder/120/120'
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
              Fundada en 2023
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Revolucionando la Salud en <span className="text-primary">México</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Somos la plataforma de telemedicina más confiable de México, conectando pacientes 
              con doctores certificados para brindar atención médica de calidad desde cualquier lugar.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                    {stat.number}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Nuestra Historia */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">
                Nuestra Historia
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Medica Movil nació de la necesidad de democratizar el acceso a la salud en México. 
                  Fundada por un equipo de médicos y tecnólogos mexicanos, nuestra misión es clara: 
                  acercar la atención médica de calidad a cada rincón del país.
                </p>
                <p>
                  Reconocimos que millones de mexicanos enfrentan barreras para acceder a atención 
                  médica especializada: distancias largas, costos elevados, y falta de especialistas 
                  en sus comunidades. La tecnología nos permite romper estas barreras.
                </p>
                <p>
                  Hoy, somos la plataforma de telemedicina líder en México, certificada por la 
                  Secretaría de Salud y reconocida por el Instituto Mexicano del Seguro Social (IMSS) 
                  como proveedor oficial de servicios de telemedicina.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-primary/20 to-blue-100 rounded-2xl p-8 h-96 flex items-center justify-center">
                <div className="text-center">
                  <Stethoscope className="h-24 w-24 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Certificación Oficial
                  </h3>
                  <p className="text-muted-foreground">
                    Avalados por la Secretaría de Salud de México
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nuestros Valores */}
      <section className="py-20 bg-muted/30">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Nuestros Valores
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Los principios que guían cada decisión y cada interacción en Medica Movil
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {valores.map((valor, index) => (
              <Card key={index} className="text-center p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <valor.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    {valor.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {valor.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Nuestro Equipo */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Nuestro Equipo Médico
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Profesionales de la salud comprometidos con la excelencia médica y la innovación
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {equipo.map((miembro, index) => (
              <Card key={index} className="text-center p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Users className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {miembro.nombre}
                  </h3>
                  <p className="text-primary font-medium mb-1">
                    {miembro.cargo}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {miembro.especialidad}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {miembro.cedula}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Certificaciones */}
      <section className="py-20 bg-muted/30">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Certificaciones y Reconocimientos
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Nuestro compromiso con la calidad está respaldado por las instituciones más prestigiosas de México
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">COFEPRIS</h3>
                <p className="text-sm text-muted-foreground">
                  Certificación sanitaria oficial
                </p>
              </CardContent>
            </Card>
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Award className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">IMSS</h3>
                <p className="text-sm text-muted-foreground">
                  Proveedor oficial de telemedicina
                </p>
              </CardContent>
            </Card>
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Stethoscope className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">CONAMED</h3>
                <p className="text-sm text-muted-foreground">
                  Registro de prestadores de servicios
                </p>
              </CardContent>
            </Card>
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">ISO 27001</h3>
                <p className="text-sm text-muted-foreground">
                  Seguridad de la información
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              ¿Tienes Preguntas?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Nuestro equipo está aquí para ayudarte
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Card className="p-4">
                <CardContent className="flex items-center space-x-3 pt-2">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="text-foreground">+52 55 1234 5678</span>
                </CardContent>
              </Card>
              <Card className="p-4">
                <CardContent className="flex items-center space-x-3 pt-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="text-foreground">Ciudad de México, México</span>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
} 
