"use client";

import { ChatRoom } from "@/components/optimized-chat-room";
import { Footer } from "@/components/footer";
import { MainNav } from "@/components/main-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMexicanCurrency, formatMexicanTime } from "@/lib/mexican-utils";
import { AppointmentStatus, ConsultationType } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Home,
  MapPin,
  MessageCircle,
  Stethoscope,
  Video,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AppointmentDetails {
  id: string;
  type: ConsultationType;
  scheduledAt: string;
  duration: number;
  status: AppointmentStatus;
  price: number;
  notes?: string;
  doctorNotes?: string;
  doctor: {
    id: string;
    specialty: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
  chatRoom: {
    id: string;
    isActive: boolean;
    startedAt: string;
    endedAt?: string;
  };
}

export default function PatientChatPage({
  params,
}: {
  params: { appointmentId: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== "PATIENT") {
      router.push("/unauthorized");
      return;
    }

    loadAppointmentDetails();
  }, [session, status, router, params.appointmentId]);

  const loadAppointmentDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/appointments/${params.appointmentId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("Cita no encontrada");
        } else if (response.status === 403) {
          setError("No tienes acceso a esta cita");
        } else {
          setError("Error al cargar los detalles de la cita");
        }
        return;
      }

      const data = await response.json();
      setAppointment(data.data);
    } catch (error) {
      console.error("Error loading appointment details:", error);
      setError("Error al cargar los detalles de la cita");
    } finally {
      setIsLoading(false);
    }
  };

  const getConsultationIcon = () => {
    if (!appointment) return <Stethoscope className="h-5 w-5" />;

    switch (appointment.type) {
      case "VIRTUAL":
        return <Video className="h-5 w-5" />;
      case "HOME_VISIT":
        return <Home className="h-5 w-5" />;
      default:
        return <Stethoscope className="h-5 w-5" />;
    }
  };

  const getConsultationDetails = () => {
    if (!appointment) return { title: "", description: "", location: "" };

    switch (appointment.type) {
      case "VIRTUAL":
        return {
          title: "Consulta Virtual",
          description: "Videollamada desde tu hogar",
          location: "En línea",
        };
      case "HOME_VISIT":
        return {
          title: "Consulta a Domicilio",
          description: "El doctor visitará tu domicilio",
          location: "Tu domicilio",
        };
      default:
        return {
          title: "Consulta Presencial",
          description: "Visita al consultorio del doctor",
          location: "Consultorio médico",
        };
    }
  };

  if (status === "loading" || isLoading) {
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

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Error
              </h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Link href="/paciente/citas">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a mis citas
                </Button>
              </Link>
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
          <Card className="max-w-md">
            <CardContent className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Cita no encontrada
              </h3>
              <p className="text-muted-foreground mb-4">
                No se pudo encontrar la información de esta cita
              </p>
              <Link href="/paciente/citas">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a mis citas
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const consultation = getConsultationDetails();

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <div className="flex-1 bg-muted/30">
        <div className="max-width-container py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <Link href="/paciente/citas">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a mis citas
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Chat de Consulta
                </h1>
                <p className="text-muted-foreground">
                  Comunícate con tu doctor antes, durante y después de la
                  consulta
                </p>
              </div>
            </div>

            {/* Appointment Context Card */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {appointment.doctor.user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {appointment.doctor.user.name}
                      </CardTitle>
                      <CardDescription>
                        {appointment.doctor.specialty}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      appointment.status === "CONFIRMED"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {appointment.status === "CONFIRMED"
                      ? "Confirmada"
                      : appointment.status === "PENDING"
                        ? "Pendiente"
                        : appointment.status === "COMPLETED"
                          ? "Completada"
                          : "Cancelada"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    {getConsultationIcon()}
                    <div>
                      <p className="font-medium text-sm">
                        {consultation.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {consultation.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {format(
                          new Date(appointment.scheduledAt),
                          "dd 'de' MMMM",
                          { locale: es }
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMexicanTime(new Date(appointment.scheduledAt))} -{" "}
                        {appointment.duration} min
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {consultation.location}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMexicanCurrency(appointment.price)}
                      </p>
                    </div>
                  </div>
                </div>

                {appointment.notes && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">
                      Motivo de consulta:
                    </p>
                    <p className="text-sm">{appointment.notes}</p>
                  </div>
                )}

                {appointment.doctorNotes && (
                  <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                    <p className="text-sm text-primary font-medium mb-1">
                      Notas del doctor:
                    </p>
                    <p className="text-sm">{appointment.doctorNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Room */}
          {appointment.chatRoom && (
            <div className="h-[600px]">
              <ChatRoom
                chatRoomId={appointment.chatRoom.id}
                appointmentId={appointment.id}
              />
            </div>
          )}

          {!appointment.chatRoom && (
            <Card>
              <CardContent className="text-center py-12">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Chat no disponible
                </h3>
                <p className="text-muted-foreground">
                  El chat estará disponible una vez que la cita sea confirmada
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
