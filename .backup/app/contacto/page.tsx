import { Metadata } from 'next';
import { Phone, Mail, MapPin, Clock, MessageCircle, Send, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Contacto - Medica Movil',
  description: 'Contáctanos para resolver tus dudas sobre nuestros servicios médicos. Soporte 24/7 disponible.',
};

export default function ContactoPage() {
  const contactInfo = [
    {
      icon: Phone,
      title: 'Teléfono de Emergencia',
      info: '+52 55 1234 5678',
      description: 'Disponible 24/7 para emergencias médicas',
      action: 'Llamar Ahora'
    },
    {
      icon: MessageCircle,
      title: 'WhatsApp',
      info: '+52 55 9876 5432',
      description: 'Soporte rápido por WhatsApp',
      action: 'Enviar Mensaje'
    },
    {
      icon: Mail,
      title: 'Email',
      info: 'soporte@medicamovil.mx',
      description: 'Respuesta en menos de 2 horas',
      action: 'Enviar Email'
    },
    {
      icon: MapPin,
      title: 'Oficinas',
      info: 'Ciudad de México, México',
      description: 'Av. Reforma 123, Col. Centro',
      action: 'Ver Ubicación'
    }
  ];

  const horarios = [
    { dia: 'Lunes - Viernes', horario: '6:00 AM - 11:00 PM' },
    { dia: 'Sábados', horario: '8:00 AM - 10:00 PM' },
    { dia: 'Domingos', horario: '8:00 AM - 8:00 PM' },
    { dia: 'Emergencias', horario: '24/7 todos los días' }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 to-blue-50 py-20">
        <div className="max-width-container">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4">
              <Heart className="h-3 w-3 mr-1" />
              Estamos Aquí para Ayudarte
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Contáctanos <span className="text-primary">24/7</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Nuestro equipo de soporte médico está disponible las 24 horas para resolver 
              tus dudas y ayudarte con cualquier consulta sobre nuestros servicios.
            </p>
          </div>
        </div>
      </section>

      {/* Información de Contacto */}
      <section className="py-20">
        <div className="max-width-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Múltiples Formas de Contactarnos
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Elige el canal que prefieras para comunicarte con nosotros
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {contactInfo.map((contact, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <contact.icon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{contact.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold text-foreground mb-2">{contact.info}</p>
                  <p className="text-sm text-muted-foreground mb-4">{contact.description}</p>
                  <Button variant="outline" size="sm" className="w-full">
                    {contact.action}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Formulario de Contacto */}
      <section className="py-20 bg-muted/30">
        <div className="max-width-container">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">
                Envíanos un Mensaje
              </h2>
              <p className="text-muted-foreground mb-8">
                Completa el formulario y nos pondremos en contacto contigo en menos de 2 horas.
              </p>
              <Card>
                <CardContent className="p-6">
                  <form className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">
                          Nombre Completo
                        </label>
                        <Input placeholder="Tu nombre completo" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">
                          Teléfono
                        </label>
                        <Input placeholder="+52 55 1234 5678" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Email
                      </label>
                      <Input type="email" placeholder="tu@email.com" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Mensaje
                      </label>
                      <Textarea 
                        placeholder="Describe tu consulta o duda..."
                        className="min-h-[120px]"
                      />
                    </div>
                    <Button className="w-full" size="lg">
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Mensaje
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              {/* Horarios de Atención */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-primary" />
                    Horarios de Atención
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {horarios.map((horario, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                        <span className="font-medium text-foreground">{horario.dia}</span>
                        <span className="text-muted-foreground">{horario.horario}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Emergencias */}
              <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
                <CardContent className="p-6 text-center">
                  <Phone className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    ¿Es una Emergencia?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Para emergencias médicas reales, llama al 911
                  </p>
                  <Button size="sm" variant="destructive" className="w-full">
                    <Phone className="h-4 w-4 mr-2" />
                    Emergencia: 911
                  </Button>
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
