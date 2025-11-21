import { NotificationPreferences } from "@/components/notification-preferences";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Configuración de Notificaciones | Medica Movil",
  description: "Personaliza cómo y cuándo quieres recibir notificaciones.",
};

export default function NotificationSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <NotificationPreferences />
    </div>
  );
}
