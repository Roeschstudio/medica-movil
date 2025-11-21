
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';
import { 
  Search, 
  Calendar, 
  Shield, 
  Clock, 
  Heart, 
  Stethoscope,
  Video,
  Home,
  Star,
  ArrowRight,
  Users,
  MapPin,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-20 lg:py-32">
        <div className="max-width-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                Encuentra y agenda
                <span className="text-primary block">citas médicas</span>
                <span className="text-secondary">fácilmente</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg">
                Conectamos pacientes con los mejores doctores de México. 
                Consultas presenciales, virtuales y a domicilio.
              </p>
              
              {/* Barra de búsqueda principal */}
              <div className="bg-card medical-card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="¿Qué especialista necesitas?"
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Ciudad o estado"
                      className="h-12 text-base"
                    />
                  </div>
                  <Link href="/buscar">
                    <Button size="lg" className="h-12 px-8 flex items-center space-x-2">
                      <Search className="h-5 w-5" />
                      <span>Buscar</span>
                    </Button>
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  Más de <span className="font-semibold text-primary">1,000 doctores</span> disponibles en toda la República Mexicana
                </p>
              </div>

              {/* Estadísticas rápidas */}
              <div className="grid grid-cols-3 gap-4 pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">1,000+</div>
                  <div className="text-sm text-muted-foreground">Doctores</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">35</div>
                  <div className="text-sm text-muted-foreground">Especialidades</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">32</div>
                  <div className="text-sm text-muted-foreground">Estados</div>
                </div>
              </div>
            </div>

            {/* Imagen del hero */}
            <div className="relative">
              <div className="aspect-[4/3] relative bg-muted rounded-2xl overflow-hidden">
                <Image
                  src="https://i.pinimg.com/originals/1e/14/5b/1e145b7b9133b8d24cd7184a8208621d.jpg"
                  alt="Doctor mexicano consultando con paciente"
                  fill
                  className="object-cover"
                  priority
                />
                {/* Overlay con estadísticas */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-background/90 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="font-semibold">4.8</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-primary" />
                        <span>+10,000 pacientes atendidos</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tipos de consulta */}
      <section className="py-16 bg-muted/30">
        <div className="max-width-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Consultas adaptadas a tus necesidades
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Elige el tipo de consulta que mejor se adapte a tu situación y agenda tu cita en minutos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Consulta Presencial */}
            <Card className="medical-card hover-lift">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                  <Stethoscope className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Consulta Presencial</CardTitle>
                <CardDescription>Visita el consultorio del doctor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Examen físico completo</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Estudios y diagnósticos</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Ubicaciones verificadas</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Desde</p>
                  <p className="text-2xl font-bold text-primary">$500 MXN</p>
                </div>
              </CardContent>
            </Card>

            {/* Consulta Virtual */}
            <Card className="medical-card hover-lift border-primary/20">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-secondary/10 rounded-full w-fit">
                  <Video className="h-8 w-8 text-secondary" />
                </div>
                <CardTitle>Consulta Virtual</CardTitle>
                <CardDescription>Telemedicina desde tu hogar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Consulta por videollamada</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Recetas digitales</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Sin necesidad de trasladarse</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Desde</p>
                  <p className="text-2xl font-bold text-secondary">$400 MXN</p>
                </div>
              </CardContent>
            </Card>

            {/* Consulta a Domicilio */}
            <Card className="medical-card hover-lift">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-success/10 rounded-full w-fit">
                  <Home className="h-8 w-8 text-success" />
                </div>
                <CardTitle>Consulta a Domicilio</CardTitle>
                <CardDescription>El doctor va hasta tu hogar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Atención personalizada</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Comodidad de tu hogar</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Ideal para adultos mayores</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Desde</p>
                  <p className="text-2xl font-bold text-success">$800 MXN</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="py-16">
        <div className="max-width-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              ¿Por qué elegir Medica Movil?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              La plataforma de citas médicas más confiable y completa de México
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center space-y-4">
              <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Doctores Verificados</h3>
              <p className="text-muted-foreground">
                Todos nuestros profesionales están certificados y verificados
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="mx-auto p-3 bg-secondary/10 rounded-full w-fit">
                <Clock className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold">Citas Rápidas</h3>
              <p className="text-muted-foreground">
                Agenda tu cita en menos de 2 minutos, disponibilidad inmediata
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="mx-auto p-3 bg-success/10 rounded-full w-fit">
                <Heart className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-xl font-semibold">Atención Personalizada</h3>
              <p className="text-muted-foreground">
                Encuentra al especialista perfecto para tus necesidades específicas
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Cobertura Nacional</h3>
              <p className="text-muted-foreground">
                Disponible en los 32 estados de la República Mexicana
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA para doctores */}
      <section className="py-16 bg-gradient-to-r from-primary to-secondary">
        <div className="max-width-container text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            ¿Eres doctor? Únete a Medica Movil
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Expande tu práctica, llega a más pacientes y gestiona tus citas de manera eficiente. 
            Sin comisiones mensuales, solo un pago único.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/doctor/registro">
              <Button size="lg" variant="secondary" className="flex items-center space-x-2">
                <Stethoscope className="h-5 w-5" />
                <span>Registrar mi Consulta</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/beneficios-doctores">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary">
                Conocer Beneficios
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
