"use client";

import { CancelAppointmentModal } from "@/components/cancel-appointment-modal";
import { Footer } from "@/components/footer";
import { MainNav } from "@/components/main-nav";
import { ReviewModal } from "@/components/review-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatMexicanCurrency,
  formatMexicanTime,
  translateAppointmentStatus,
  translateConsultationType,
} from "@/lib/mexican-utils";
import { AppointmentStatus, ConsultationType } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Home,
  MessageCircle,
  Plus,
  Star,
  Stethoscope,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorImage?: string;
  type: ConsultationType;
  scheduledAt: string;
  duration: number;
  price: number;
  status: AppointmentStatus;
  notes?: string;
  patientNotes?: string;
  doctorNotes?: string;
  createdAt: string;
}

export default function PatientAppointmentsClient() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Estados para modales
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    appointmentId: string;
    doctorName: string;
  }>({
    isOpen: false,
    appointmentId: "",
    doctorName: "",
  });

  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    appointmentId: string;
    appointmentDate: Date;
    doctorName: string;
    price: number;
  }>({
    isOpen: false,
    appointmentId: "",
    appointmentDate: new Date(),
    doctorName: "",
    price: 0,
  });

  useEffect(() => {
    loadAppointments();
  }, [activeTab]);

  const loadAppointments = async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") {
        params.append("status", activeTab);
      }

      const response = await fetch(`/api/appointments?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Error al cargar citas");
      }

      const data = await response.json();
      setAppointments(data.appointments);
    } catch (error) {
      console.error("Error loading appointments:", error);
      toast.error("Error al cargar las citas");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-primary/10 text-primary border-primary/20";
      case "COMPLETED":
        return "bg-success/10 text-success border-success/20";
      case "CANCELLED":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "NO_SHOW":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getConsultationIcon = (type: ConsultationType) => {
    switch (type) {
      case "VIRTUAL":
        return <Video className="h-4 w-4" />;
      case "HOME_VISIT":
        return <Home className="h-4 w-4" />;
      default:
        return <Stethoscope className="h-4 w-4" />;
    }
  };

  const filterAppointments = (appointments: Appointment[], status: string) => {
    if (status === "all") return appointments;
    return appointments.filter((appointment) => appointment.status === status);
  };

  const getTabCounts = (appointments: Appointment[]) => {
    const all = appointments.length;
    const pending = appointments.filter((a) => a.status === "PENDING").length;
    const confirmed = appointments.filter(
      (a) => a.status === "CONFIRMED"
    ).length;
    const completed = appointments.filter(
      (a) => a.status === "COMPLETED"
    ).length;

    return { all, pending, confirmed, completed };
  };

  const counts = getTabCounts(appointments);

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => {
    const appointmentDate = new Date(appointment.scheduledAt);
    const isUpcoming = appointmentDate > new Date();

    return (
      <Card className="appointment-card">
        <CardHeader className="flex flex-row space-y-0 space-x-4">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted">
            {appointment.doctorImage ? (
              <Image
                src="https://headshots-inc.com/wp-content/uploads/2021/01/Professional-Headshot-Examples-31-1.jpg"
                alt={`Foto de ${appointment.doctorName}`}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {appointment.doctorName}
              </CardTitle>
              <Badge
                variant="outline"
                className={getStatusColor(appointment.status)}
              >
                {translateAppointmentStatus(appointment.status)}
              </Badge>
            </div>
            <CardDescription className="font-medium text-primary">
              {appointment.doctorSpecialty}
            </CardDescription>

            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(appointmentDate, "dd 'de' MMM, yyyy", { locale: es })}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{formatMexicanTime(appointmentDate)}</span>
              </div>
              <ChatStatusIndicator
                appointmentId={appointment.id}
                appointmentStatus={appointment.status}
                showText={false}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Tipo de consulta y precio */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getConsultationIcon(appointment.type)}
              <span className="text-sm font-medium">
                {translateConsultationType(appointment.type)}
              </span>
              <Badge variant="outline">
                {formatMexicanCurrency(appointment.price)}
              </Badge>
            </div>

            <span className="text-sm text-muted-foreground">
              {appointment.duration} min
            </span>
          </div>

          {/* Notas */}
          {appointment.notes && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">
                Motivo de consulta:
              </p>
              <p className="text-sm">{appointment.notes}</p>
            </div>
          )}

          {appointment.doctorNotes && (
            <div className="bg-primary/5 p-3 rounded-lg">
              <p className="text-sm text-primary font-medium mb-1">
                Notas del doctor:
              </p>
              <p className="text-sm">{appointment.doctorNotes}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              {appointment.status === "COMPLETED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setReviewModal({
                      isOpen: true,
                      appointmentId: appointment.id,
                      doctorName: appointment.doctorName,
                    })
                  }
                >
                  <Star className="h-4 w-4 mr-1" />
                  Calificar
                </Button>
              )}

              {appointment.status === "CONFIRMED" && (
                <Link href={`/chat/${appointment.id}`}>
                  <Button size="sm" variant="outline">
                    <MessageCircle className="h-4 w-4 mr-1" />
                    Chat
                  </Button>
                </Link>
              )}

              {isUpcoming &&
                appointment.status === "CONFIRMED" &&
                appointment.type === "VIRTUAL" && (
                  <Button size="sm" variant="default">
                    <Video className="h-4 w-4 mr-1" />
                    Unirse
                  </Button>
                )}
            </div>

            <div className="flex items-center space-x-2">
              <Link href={`/doctor/${appointment.doctorId}`}>
                <Button size="sm" variant="outline">
                  Ver Doctor
                </Button>
              </Link>

              {isUpcoming &&
                (appointment.status === "PENDING" ||
                  appointment.status === "CONFIRMED") && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      setCancelModal({
                        isOpen: true,
                        appointmentId: appointment.id,
                        appointmentDate: new Date(appointment.scheduledAt),
                        doctorName: appointment.doctorName,
                        price: appointment.price,
                      })
                    }
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <Card>
      <CardContent className="text-center py-12">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No tienes citas
        </h3>
        <p className="text-muted-foreground mb-4">{message}</p>
        <Link href="/buscar">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Buscar Doctor
          </Button>
        </Link>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <div className="flex-1 bg-muted/30">
        <div className="max-width-container py-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Mis Citas Médicas
                </h1>
                <p className="text-muted-foreground">
                  Gestiona tus citas y consulta tu historial médico
                </p>
              </div>

              <Link href="/buscar">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Cita
                </Button>
              </Link>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">Todas ({counts.all})</TabsTrigger>
                <TabsTrigger value="PENDING">
                  Pendientes ({counts.pending})
                </TabsTrigger>
                <TabsTrigger value="CONFIRMED">
                  Confirmadas ({counts.confirmed})
                </TabsTrigger>
                <TabsTrigger value="COMPLETED">
                  Completadas ({counts.completed})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                          <div className="flex space-x-4">
                            <div className="w-12 h-12 bg-muted rounded-full" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-muted rounded w-1/2" />
                              <div className="h-3 bg-muted rounded w-1/3" />
                              <div className="h-3 bg-muted rounded w-2/3" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filterAppointments(appointments, activeTab).length > 0 ? (
                  <div className="space-y-4">
                    {filterAppointments(appointments, activeTab).map(
                      (appointment) => (
                        <AppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                        />
                      )
                    )}
                  </div>
                ) : (
                  <EmptyState
                    message={
                      activeTab === "all"
                        ? "Aún no has agendado ninguna cita médica"
                        : `No tienes citas ${
                            activeTab === "PENDING"
                              ? "pendientes"
                              : activeTab === "CONFIRMED"
                              ? "confirmadas"
                              : "completadas"
                          }`
                    }
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Footer />

      {/* Modales */}
      <ReviewModal
        isOpen={reviewModal.isOpen}
        onClose={() => setReviewModal((prev) => ({ ...prev, isOpen: false }))}
        appointmentId={reviewModal.appointmentId}
        doctorName={reviewModal.doctorName}
        onReviewSubmitted={() => {
          loadAppointments();
          setReviewModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      <CancelAppointmentModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal((prev) => ({ ...prev, isOpen: false }))}
        appointmentId={cancelModal.appointmentId}
        appointmentDate={cancelModal.appointmentDate}
        doctorName={cancelModal.doctorName}
        price={cancelModal.price}
        onCancelled={() => {
          loadAppointments();
          setCancelModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
}
