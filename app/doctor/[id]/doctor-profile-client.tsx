
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AppointmentCalendar } from '@/components/appointment-calendar';
import { AppointmentBookingModal } from '@/components/appointment-booking-modal';
import { 
  Star, 
  MapPin, 
  Clock, 
  Shield, 
  Stethoscope,
  Video,
  Home,
  Phone,
  Mail,
  Calendar,
  Award,
  Users,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMexicanCurrency, translateConsultationType } from '@/lib/mexican-utils';
import { ConsultationType } from '@prisma/client';

interface Review {
  id: string;
  rating: number;
  comment: string;
  patientName: string;
  createdAt: string;
}

interface Doctor {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  specialty: string;
  licenseNumber?: string;
  bio?: string;
  city: string;
  state: string;
  address?: string;
  zipCode?: string;
  profileImage?: string;
  averageRating: number;
  totalReviews: number;
  totalAppointments: number;
  acceptsInPerson: boolean;
  acceptsVirtual: boolean;
  acceptsHomeVisits: boolean;
  priceInPerson?: number;
  priceVirtual?: number;
  priceHomeVisit?: number;
  firstConsultationFree: boolean;
  isVerified: boolean;
  durationInPerson: number;
  durationVirtual: number;
  durationHomeVisit: number;
  workingHours?: any;
  videoCallLink?: string;
  reviews: Review[];
  blockedDays: any[];
}

interface DoctorProfileClientProps {
  doctor: Doctor;
}

export function DoctorProfileClient({ doctor }: DoctorProfileClientProps) {
  const [selectedConsultationType, setSelectedConsultationType] = useState<ConsultationType>('IN_PERSON');
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number>(0);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const consultationTypes = [
    {
      type: 'IN_PERSON' as ConsultationType,
      available: doctor.acceptsInPerson,
      price: doctor.priceInPerson,
      duration: doctor.durationInPerson,
      icon: Stethoscope,
      title: 'Presencial',
      description: 'Visita el consultorio'
    },
    {
      type: 'VIRTUAL' as ConsultationType,
      available: doctor.acceptsVirtual,
      price: doctor.priceVirtual,
      duration: doctor.durationVirtual,
      icon: Video,
      title: 'Virtual',
      description: 'Videollamada online'
    },
    {
      type: 'HOME_VISIT' as ConsultationType,
      available: doctor.acceptsHomeVisits,
      price: doctor.priceHomeVisit,
      duration: doctor.durationHomeVisit,
      icon: Home,
      title: 'Domicilio',
      description: 'El doctor va a tu casa'
    }
  ].filter(type => type.available);

  const handleSlotSelect = (dateTime: Date, price: number) => {
    setSelectedDateTime(dateTime);
    setSelectedPrice(price);
    setShowBookingModal(true);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating
            ? 'text-yellow-500 fill-current'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      <div className="flex-1 bg-muted/30">
        <div className="max-width-container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Información del doctor */}
            <div className="lg:col-span-1 space-y-6">
              {/* Perfil principal */}
              <Card>
                <CardHeader className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    {doctor.profileImage ? (
                      <Image
                        src="https://images.unsplash.com/photo-1622253694238-3b22139576c6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1288&h=1288&q=80&crop=faces,top,right"
                        alt={`Foto de ${doctor.name}`}
                        fill
                        className="object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 rounded-full flex items-center justify-center">
                        <Stethoscope className="h-12 w-12 text-primary" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-center space-x-2">
                    <CardTitle className="text-xl">{doctor.name}</CardTitle>
                    {doctor.isVerified && (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        <Shield className="h-3 w-3 mr-1" />
                        Verificado
                      </Badge>
                    )}
                  </div>
                  
                  <CardDescription className="text-primary font-medium">
                    {doctor.specialty}
                  </CardDescription>

                  <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>{doctor.city}, {doctor.state}</span>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center justify-center space-x-2">
                    <div className="flex items-center space-x-1">
                      {renderStars(Math.round(doctor.averageRating))}
                    </div>
                    <span className="font-medium">{doctor.averageRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">
                      ({doctor.totalReviews} reseñas)
                    </span>
                  </div>

                  {doctor.firstConsultationFree && (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      Primera consulta gratis
                    </Badge>
                  )}
                </CardHeader>
              </Card>

              {/* Estadísticas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Estadísticas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Pacientes atendidos</span>
                    </div>
                    <span className="font-medium">{doctor.totalAppointments}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Reseñas</span>
                    </div>
                    <span className="font-medium">{doctor.totalReviews}</span>
                  </div>

                  {doctor.licenseNumber && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Cédula profesional</span>
                      </div>
                      <span className="font-medium text-xs">{doctor.licenseNumber}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contacto */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {doctor.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{doctor.phone}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{doctor.email}</span>
                  </div>

                  {doctor.address && (
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm">
                        <p>{doctor.address}</p>
                        <p className="text-muted-foreground">
                          {doctor.city}, {doctor.state} {doctor.zipCode}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Contenido principal */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="agendar" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="agendar">
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendar Cita
                  </TabsTrigger>
                  <TabsTrigger value="informacion">
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Información
                  </TabsTrigger>
                  <TabsTrigger value="resenas">
                    <Star className="h-4 w-4 mr-2" />
                    Reseñas
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Agendar Cita */}
                <TabsContent value="agendar" className="space-y-6">
                  {/* Tipos de consulta */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Tipos de consulta disponibles</CardTitle>
                      <CardDescription>
                        Selecciona el tipo de consulta que prefieras
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {consultationTypes.map((consultation) => {
                          const Icon = consultation.icon;
                          const isSelected = selectedConsultationType === consultation.type;
                          
                          return (
                            <Card
                              key={consultation.type}
                              className={`cursor-pointer transition-all ${
                                isSelected 
                                  ? 'ring-2 ring-primary bg-primary/5' 
                                  : 'hover:shadow-md'
                              }`}
                              onClick={() => setSelectedConsultationType(consultation.type)}
                            >
                              <CardContent className="p-4 text-center">
                                <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                                <h3 className="font-medium mb-1">{consultation.title}</h3>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {consultation.description}
                                </p>
                                <Badge variant="outline">
                                  {formatMexicanCurrency(consultation.price || 0)}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {consultation.duration} min
                                </p>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Calendario */}
                  <AppointmentCalendar
                    doctorId={doctor.id}
                    consultationType={selectedConsultationType}
                    onSlotSelect={handleSlotSelect}
                    selectedSlot={selectedDateTime || undefined}
                  />
                </TabsContent>

                {/* Tab: Información */}
                <TabsContent value="informacion">
                  <Card>
                    <CardHeader>
                      <CardTitle>Acerca del doctor</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {doctor.bio ? (
                        <div>
                          <h3 className="font-medium mb-2">Biografía</h3>
                          <p className="text-muted-foreground leading-relaxed">
                            {doctor.bio}
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            El doctor no ha agregado información adicional aún.
                          </p>
                        </div>
                      )}

                      <Separator />

                      <div>
                        <h3 className="font-medium mb-4">Servicios disponibles</h3>
                        <div className="space-y-3">
                          {consultationTypes.map((consultation) => {
                            const Icon = consultation.icon;
                            return (
                              <div key={consultation.type} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <Icon className="h-5 w-5 text-primary" />
                                  <div>
                                    <p className="font-medium">{consultation.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {consultation.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">
                                    {formatMexicanCurrency(consultation.price || 0)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {consultation.duration} min
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Reseñas */}
                <TabsContent value="resenas">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Reseñas de pacientes</span>
                        <Badge variant="outline">
                          {doctor.averageRating.toFixed(1)} ⭐ ({doctor.totalReviews})
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {doctor.reviews.length > 0 ? (
                        <div className="space-y-4">
                          {doctor.reviews.map((review) => (
                            <div key={review.id} className="border-b border-border pb-4 last:border-b-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{review.patientName}</span>
                                  <div className="flex items-center space-x-1">
                                    {renderStars(review.rating)}
                                  </div>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(review.createdAt), "dd 'de' MMM, yyyy", { locale: es })}
                                </span>
                              </div>
                              {review.comment && (
                                <p className="text-muted-foreground">
                                  {review.comment}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            Este doctor aún no tiene reseñas.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de reserva */}
      {showBookingModal && selectedDateTime && (
        <AppointmentBookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          doctor={doctor}
          consultationType={selectedConsultationType}
          selectedDateTime={selectedDateTime}
          price={selectedPrice}
        />
      )}

      <Footer />
    </div>
  );
}
