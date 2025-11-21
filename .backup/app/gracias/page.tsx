import { Metadata } from 'next';
import { CheckCircle, Heart, Calendar, Phone, MessageCircle, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Gracias - Medica Movil',
  description: 'Gracias por confiar en Medica Movil. Tu cita ha sido agendada exitosamente.',
};

export default function GraciasPage() {
  const siguientesPasos = [
    {
      icon: CheckCircle,
      title: 'Cita Confirmada',
      description: 'Recibirás un email de confirmación con todos los detalles de tu cita médica.'
    },
    {
      icon: Calendar,
      title: 'Prepárate para tu Consulta',
      description: 'Te enviaremos un recordatorio 30 minutos antes con el enlace de la videollamada.'
    },
    {
      icon: Phone,
      title: 'Únete a tu Consulta',
      description: 'Haz clic en el enlace a la hora programada y conecta con tu doctor.'
    }
  ];

  const consejos = [
    '📱 Asegúrate de tener buena conexión a internet',
    '🎧 Usa audífonos para mejor calidad de audio',
    '📋 Ten a la mano tu historial médico y medicamentos actuales',
    '🆔 Ten tu identificación oficial lista',
    '📝 Prepara una lista de preguntas para tu doctor'
  ];

  const testimonios = [
    {
      nombre: 'María González',
      ubicacion: 'CDMX',
      comentario: 'Excelente servicio, el doctor fue muy profesional y la plataforma muy fácil de usar.',
      estrellas: 5
    },
    {
      nombre: 'Carlos Hernández',
      ubicacion: 'Guadalajara',
      comentario: 'Me salvó un viaje al hospital. La consulta fue completa y recibí mi receta al instante.',
      estrellas: 5
    },
    {
      nombre: 'Ana Martínez',
      ubicacion: 'Monterrey',
      comentario: 'Perfecto para consultas de seguimiento. El doctor recordaba todo mi historial.',
      estrellas: 5
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-green-50 to-blue-50 py-20">
        <div className="max-width-container">
          <div className="text-center max-w-4xl mx-auto">
            <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <Badge variant="secondary" className="mb-4">
              <Heart className="h-3 w-3 mr-1" />
              Cita Confirmada
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              ¡Gracias por Confiar en <span className="text-primary">Medica Movil</span>!
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Tu cita médica ha sido agendada exitosamente. Estamos emocionados de poder 
              cuidar de tu salud con la mejor atención médica digital de México.
            </p>
            <div className="bg-white/50 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="font-semibold text-foreground mb-2">Detalles de tu Cita</h3>
              <p className="text-sm text-muted-foreground">
                Revisa tu email para ver todos los detalles de tu consulta médica.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Siguientes Pasos */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              ¿Qué Sigue Ahora?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Te guiamos paso a paso para que tengas la mejor experiencia en tu consulta médica
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {siguientesPasos.map((paso, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="pt-8 pb-6">
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <paso.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-4">
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    {paso.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {paso.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Consejos para tu Consulta */}
      <section className="py-20 bg-muted/30">
        <div className="max-width-container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">
                Consejos para tu Consulta Virtual
              </h2>
              <p className="text-muted-foreground mb-8">
                Para aprovechar al máximo tu consulta médica virtual, te recomendamos seguir estos consejos:
              </p>
              <div className="space-y-4">
                {consejos.map((consejo, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-muted-foreground">{consejo}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary/20 to-blue-100 rounded-2xl p-8">
              <div className="text-center">
                <Calendar className="h-16 w-16 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  ¿Necesitas Reagendar?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Puedes modificar o cancelar tu cita hasta 2 horas antes sin costo adicional.
                </p>
                <Button variant="outline" className="w-full">
                  Gestionar mi Cita
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Lo que Dicen Nuestros Pacientes
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Miles de mexicanos ya confían en Medica Movil para su atención médica
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonios.map((testimonio, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonio.estrellas)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 italic">
                    "{testimonio.comentario}"
                  </p>
                  <div className="border-t pt-4">
                    <p className="font-semibold text-foreground">{testimonio.nombre}</p>
                    <p className="text-sm text-muted-foreground">{testimonio.ubicacion}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Soporte */}
      <section className="py-20 bg-muted/30">
        <div className="max-width-container">
          <Card className="bg-gradient-to-r from-primary/10 to-blue-50">
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-4">
                ¿Necesitas Ayuda?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Nuestro equipo de soporte está disponible 24/7 para ayudarte con cualquier 
                duda sobre tu consulta médica o problemas técnicos.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/contacto">
                  <Button size="lg">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Contactar Soporte
                  </Button>
                </Link>
                <Button size="lg" variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  +52 55 1234 5678
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Comparte tu Experiencia
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Ayuda a otros mexicanos a conocer Medica Movil compartiendo tu experiencia
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/buscar">
                <Button size="lg" variant="outline">
                  Agendar Otra Cita
                </Button>
              </Link>
              <Button size="lg">
                <Heart className="h-4 w-4 mr-2" />
                Recomendar a un Amigo
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
} 
