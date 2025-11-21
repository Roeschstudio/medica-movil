"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare, Phone, Save, Settings } from "lucide-react";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import { useEffect, useState } from "react";

export function NotificationPreferences() {
  const { user } = useUnifiedAuth();
  const { toast } = useToast();
  const {
    preferences: currentPreferences,
    updatePreferences,
    loadPreferences,
  } = useNotifications();
  const [preferences, setPreferences] = useState(currentPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchPreferences();
    }
  }, [user?.id]);

  useEffect(() => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
      setLoading(false);
    }
  }, [currentPreferences]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      await loadPreferences();
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las preferencias de notificación.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      const success = await updatePreferences(preferences);

      if (success) {
        toast({
          title: "Preferencias guardadas",
          description:
            "Tus preferencias de notificación han sido actualizadas.",
        });
      } else {
        throw new Error("Failed to save preferences");
      }
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar las preferencias de notificación.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: string, value: boolean | string) => {
    if (!preferences) return;

    if (key.includes(".")) {
      // Handle nested properties like quietHours.enabled
      const [parent, child] = key.split(".");
      setPreferences((prev) =>
        prev
          ? {
              ...prev,
              [parent]: {
                ...(prev as any)[parent],
                [child]: value,
              },
            }
          : null
      );
    } else {
      setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Debes iniciar sesión para configurar tus notificaciones.
        </p>
      </div>
    );
  }

  if (loading || !preferences) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Cargando preferencias...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Configuración de Notificaciones
          </h1>
          <p className="text-muted-foreground">
            Personaliza cómo y cuándo quieres recibir notificaciones.
          </p>
        </div>
        <Button onClick={savePreferences} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Canales de Notificación
          </CardTitle>
          <CardDescription>
            Selecciona los métodos por los cuales quieres recibir
            notificaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-blue-600" />
              <div>
                <Label htmlFor="email" className="text-base font-medium">
                  Correo Electrónico
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones por email
                </p>
              </div>
            </div>
            <Switch
              id="email"
              checked={preferences.email}
              onCheckedChange={(checked) => updatePreference("email", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-green-600" />
              <div>
                <Label htmlFor="sms" className="text-base font-medium">
                  SMS
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones por mensaje de texto
                </p>
              </div>
            </div>
            <Switch
              id="sms"
              checked={preferences.sms}
              onCheckedChange={(checked) => updatePreference("sms", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              <div>
                <Label htmlFor="whatsapp" className="text-base font-medium">
                  WhatsApp
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones por WhatsApp
                </p>
              </div>
            </div>
            <Switch
              id="whatsapp"
              checked={preferences.whatsapp}
              onCheckedChange={(checked) =>
                updatePreference("whatsapp", checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-purple-600" />
              <div>
                <Label htmlFor="browser" className="text-base font-medium">
                  Notificaciones del Navegador
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones push en el navegador
                </p>
              </div>
            </div>
            <Switch
              id="browser"
              checked={preferences.browser}
              onCheckedChange={(checked) =>
                updatePreference("browser", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Tipos de Notificación
          </CardTitle>
          <CardDescription>
            Controla qué tipos de notificaciones quieres recibir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="appointmentReminders"
                className="text-base font-medium"
              >
                Recordatorios de Citas
              </Label>
              <p className="text-sm text-muted-foreground">
                Recordatorios antes de tus citas médicas
              </p>
            </div>
            <Switch
              id="appointmentReminders"
              checked={preferences.appointmentReminders}
              onCheckedChange={(checked) =>
                updatePreference("appointmentReminders", checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="chatMessages" className="text-base font-medium">
                Mensajes de Chat
              </Label>
              <p className="text-sm text-muted-foreground">
                Notificaciones cuando recibas mensajes en el chat
              </p>
            </div>
            <Switch
              id="chatMessages"
              checked={preferences.chatMessages}
              onCheckedChange={(checked) =>
                updatePreference("chatMessages", checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="systemUpdates" className="text-base font-medium">
                Actualizaciones del Sistema
              </Label>
              <p className="text-sm text-muted-foreground">
                Notificaciones sobre cambios importantes en la plataforma
              </p>
            </div>
            <Switch
              id="systemUpdates"
              checked={preferences.systemUpdates}
              onCheckedChange={(checked) =>
                updatePreference("systemUpdates", checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="marketingEmails"
                className="text-base font-medium"
              >
                Emails de Marketing
              </Label>
              <p className="text-sm text-muted-foreground">
                Promociones, ofertas especiales y noticias de salud
              </p>
            </div>
            <Switch
              id="marketingEmails"
              checked={preferences.marketingEmails}
              onCheckedChange={(checked) =>
                updatePreference("marketingEmails", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horario de Silencio
          </CardTitle>
          <CardDescription>
            Configura un horario durante el cual no recibirás notificaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="quietHoursEnabled"
                className="text-base font-medium"
              >
                Activar Horario de Silencio
              </Label>
              <p className="text-sm text-muted-foreground">
                Las notificaciones se silenciarán durante el horario configurado
              </p>
            </div>
            <Switch
              id="quietHoursEnabled"
              checked={preferences.quietHours.enabled}
              onCheckedChange={(checked) =>
                updatePreference("quietHours.enabled", checked)
              }
            />
          </div>

          {preferences.quietHours.enabled && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime" className="text-sm font-medium">
                    Hora de Inicio
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={preferences.quietHours.startTime}
                    onChange={(e) =>
                      updatePreference("quietHours.startTime", e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endTime" className="text-sm font-medium">
                    Hora de Fin
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={preferences.quietHours.endTime}
                    onChange={(e) =>
                      updatePreference("quietHours.endTime", e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Información Importante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            • Las notificaciones críticas relacionadas con la seguridad de tu
            cuenta siempre se enviarán, independientemente de estas
            configuraciones.
          </p>
          <p className="text-sm text-muted-foreground">
            • Los recordatorios de citas médicas son altamente recomendados para
            no perder tus consultas.
          </p>
          <p className="text-sm text-muted-foreground">
            • Puedes cambiar estas preferencias en cualquier momento desde tu
            perfil.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
