"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import { AlertTriangle, Loader2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface AdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { user, loading } = useUnifiedAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/iniciar-sesion");
      } else if (user.role !== "ADMIN") {
        router.push("/unauthorized");
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-96">
            <CardContent className="flex flex-col items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Verificando acceso</h3>
              <p className="text-sm text-gray-600 text-center">
                Validando permisos de administrador...
              </p>
            </CardContent>
          </Card>
        </div>
      )
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="h-8 w-8 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error de acceso</h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              Debes iniciar sesión para acceder a esta página.
            </p>
            <Button
              onClick={() => router.push("/iniciar-sesion")}
              variant="default"
            >
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Shield className="h-8 w-8 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso denegado</h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              No tienes permisos de administrador para acceder a esta página.
            </p>
            <Button onClick={() => router.push("/")} variant="default">
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
