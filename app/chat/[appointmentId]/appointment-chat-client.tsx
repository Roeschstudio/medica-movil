"use client";

import { ChatRoom } from "@/components/optimized-chat-room";
import { Footer } from "@/components/footer";
import { MainNav } from "@/components/main-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useChat } from "@/hooks/use-chat";
import { useToast } from "@/hooks/use-toast";
import {
  formatMexicanCurrency,
  formatMexicanTime,
  translateAppointmentStatus,
  translateConsultationType,
} from "@/lib/mexican-utils";
import type { Appointment, Doctor, User as UserType } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Home,
  Mail,
  MapPin,
  Phone,
  Stethoscope,
  User,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AppointmentChatClientProps {
  appointmentId: string;
  userId: string;
  userName: string;
  userRole: string;
}

interface AppointmentDetails extends Appointment {
  doctor?: Doctor & { user?: UserType };
  patient?: UserType;
}

export default function AppointmentChatClient({
  appointmentId,
  userId,
  userName,
  userRole,
}: AppointmentChatClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize chat hook
  const {
    chatRoom,
    isLoading: isChatLoading,
    error: chatError,
    isConnected,
    cleanup,
  } = useChat({
    appointmentId,
    userId,
    userName,
    userRole,
    autoConnect: true,
    onError: (error) => {
      toast({
        title: "Error de Chat",
        description: error.message,
        variant: "destructive",
      });
    },
    onConnectionChange: (connected) => {
      if (!connected) {
        toast({
          title: "Conexión perdida",
          description: "Intentando reconectar...",
          variant: "destructive",
        });
      }
    },
  });

  // Load appointment details
  useEffect(() => {
    const loadAppointmentDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/appointments/${appointmentId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Cita no encontrada");
          } else if (response.status === 403) {
            throw new Error("No tienes acceso a esta cita");
          }
          throw new Error("Error al cargar los detalles de la cita");
        }

        const data = await response.json();
        setAppointment(data);

        // Verify user has access to this appointment
        const hasAccess =
          (userRole === "PATIENT" && data.patientId === userId) ||
          (userRole === "DOCTOR" && data.doctorId === userId);

        if (!hasAccess) {
          throw new Error("No tienes acceso a esta cita");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error desconocido";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (appointmentId) {
      loadAppointmentDetails();
    }

    // Cleanup chat on unmount
    return () => {
      cleanup();
    };
  }, [appointmentId, userId, userRole, toast, cleanup]);

  const getConsultationIcon = (type: string) => {
    switch (type) {
      case "VIRTUAL":
        return <Video className="h-4 w-4" />;
      case "HOME_VISIT":
        return <Home className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-100 text-green-800 border-green-200";
      case "COMPLETED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getBackUrl = () => {
    return userRole === "DOCTOR" ? "/doctor/agenda" : "/paciente/citas";
  };

  if (isLoading || isChatLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || chatError) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center text-destructive">
                Error
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">{error || chatError}</p>
              <div className="flex justify-center space-x-2">
                <Button variant="outline" onClick={() => router.back()}>
                  Volver
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Reintentar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">Cita no encontrada</p>
              <Button
                className="mt-4"
                onClick={() => router.push(getBackUrl())}
              >
                Volver a mis citas
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const appointmentDate = new Date(appointment.scheduledAt);
  const otherUser =
    userRole === "DOCTOR" ? appointment.patient : appointment.doctor?.user;

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <div className="flex-1 bg-muted/30">
        <div className="max-width-container py-6">
          {/* Header with back navigation */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <Link href={getBackUrl()}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Chat de Consulta
                </h1>
                <p className="text-muted-foreground">
                  Comunicación en tiempo real con{" "}
                  {userRole === "DOCTOR" ? "el paciente" : "el doctor"}
                </p>
              </div>
            </div>

            {/* Connection status */}
            {!isConnected && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-yellow-600 border-t-transparent rounded-full" />
                  <span className="text-sm text-yellow-800">
                    Conectando al chat...
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Appointment Details Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Appointment Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Detalles de la Cita</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Estado
                    </label>
                    <div className="mt-1">
                      <Badge className={getStatusColor(appointment.status)}>
                        {translateAppointmentStatus(appointment.status)}
                      </Badge>
                    </div>
                  </div>

                  {/* Date and Time */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Fecha y Hora
                    </label>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(appointmentDate, "dd 'de' MMMM, yyyy", {
                            locale: es,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Clock className="h-4 w-4" />
                        <span>{formatMexicanTime(appointmentDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Consultation Type */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Tipo de Consulta
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      {getConsultationIcon(appointment.type)}
                      <span className="text-sm">
                        {translateConsultationType(appointment.type)}
                      </span>
                    </div>
                  </div>

                  {/* Duration and Price */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Duración
                      </label>
                      <p className="text-sm mt-1">{appointment.duration} min</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Precio
                      </label>
                      <p className="text-sm mt-1 font-semibold">
                        {formatMexicanCurrency(appointment.price)}
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  {appointment.notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Motivo de consulta
                      </label>
                      <p className="text-sm mt-1 bg-muted p-2 rounded">
                        {appointment.notes}
                      </p>
                    </div>
                  )}

                  {appointment.patientNotes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Notas del paciente
                      </label>
                      <p className="text-sm mt-1 bg-muted p-2 rounded">
                        {appointment.patientNotes}
                      </p>
                    </div>
                  )}

                  {appointment.doctorNotes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Notas del doctor
                      </label>
                      <p className="text-sm mt-1 bg-primary/5 p-2 rounded">
                        {appointment.doctorNotes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Other User Info Card */}
              {otherUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>
                        {userRole === "DOCTOR"
                          ? "Información del Paciente"
                          : "Información del Doctor"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Avatar and Name */}
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={otherUser.image || undefined} />
                        <AvatarFallback>
                          {otherUser.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{otherUser.name}</h3>
                        {userRole === "PATIENT" && appointment.doctor && (
                          <p className="text-sm text-muted-foreground">
                            {appointment.doctor.specialty}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Contact Info */}
                    {otherUser.email && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{otherUser.email}</span>
                      </div>
                    )}

                    {otherUser.phone && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{otherUser.phone}</span>
                      </div>
                    )}

                    {/* Doctor specific info */}
                    {userRole === "PATIENT" && appointment.doctor && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Stethoscope className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {appointment.doctor.specialty}
                            </span>
                          </div>

                          {appointment.doctor.licenseNumber && (
                            <div className="text-xs text-muted-foreground">
                              Cédula: {appointment.doctor.licenseNumber}
                            </div>
                          )}

                          {appointment.doctor.averageRating > 0 && (
                            <div className="flex items-center space-x-1 text-sm">
                              <span>⭐</span>
                              <span>
                                {appointment.doctor.averageRating.toFixed(1)}
                              </span>
                              <span className="text-muted-foreground">
                                ({appointment.doctor.totalReviews} reseñas)
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {appointment.type === "VIRTUAL" &&
                    appointment.status === "CONFIRMED" && (
                      <Button className="w-full" size="sm">
                        <Video className="h-4 w-4 mr-2" />
                        Iniciar Videollamada
                      </Button>
                    )}

                  <Link href={getBackUrl()}>
                    <Button variant="outline" className="w-full" size="sm">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Volver a Citas
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Chat Interface */}
            <div className="lg:col-span-3">
              {chatRoom ? (
                <ChatRoom
                  chatRoomId={chatRoom.id}
                  appointmentId={appointmentId}
                  className="h-[600px]"
                />
              ) : (
                <Card className="h-[600px] flex items-center justify-center">
                  <CardContent className="text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Inicializando chat...
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
