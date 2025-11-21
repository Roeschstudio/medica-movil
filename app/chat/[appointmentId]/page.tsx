import { authOptions } from "@/lib/unified-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AppointmentChatClient from "./appointment-chat-client";

interface PageProps {
  params: {
    appointmentId: string;
  };
}

export default async function AppointmentChatPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/iniciar-sesion");
  }

  // Only doctors and patients can access chat
  if (!["DOCTOR", "PATIENT"].includes(session.user.role)) {
    redirect("/unauthorized");
  }

  return (
    <AppointmentChatClient
      appointmentId={params.appointmentId}
      userId={session.user.id}
      userName={session.user.name}
      userRole={session.user.role}
    />
  );
}
