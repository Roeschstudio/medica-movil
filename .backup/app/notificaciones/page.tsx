import { NotificationHistory } from "@/components/notification-history";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notificaciones | Medica Movil",
  description:
    "Gestiona tus notificaciones y mantente al día con tus citas médicas.",
};

export default function NotificationsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <NotificationHistory />
    </div>
  );
}
