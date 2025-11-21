import { prisma } from "@/lib/db";
import { createSupabaseMiddlewareClient } from "@/lib/supabase";
import { UserRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);
  const pathname = request.nextUrl.pathname;

  // Rutas públicas que no requieren autenticación
  const publicRoutes = [
    "/",
    "/buscar",
    "/doctores",
    "/iniciar-sesion",
    "/registrarse",
    "/auth/error",
    "/unauthorized",
    "/api/auth",
    "/servicios",
    "/sobre-nosotros",
    "/contacto",
    "/beneficios-doctores",
  ];

  // Si es una ruta pública, permitir acceso
  if (
    publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(route)
    )
  ) {
    return response;
  }

  try {
    // Verificar autenticación con Supabase (unified approach)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Si no hay usuario autenticado, redirigir al login
    if (error || !user) {
      return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
    }

    // Obtener información completa del usuario de nuestra base de datos
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: {
        id: true,
        role: true,
        isActive: true,
        name: true,
        email: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
    }

    const role = dbUser.role as UserRole;

    // Rutas específicas por rol
    if (pathname.startsWith("/admin")) {
      if (role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }

    if (pathname.startsWith("/doctor")) {
      if (role !== UserRole.DOCTOR) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }

    if (pathname.startsWith("/paciente")) {
      if (role !== UserRole.PATIENT) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }

    // Add user info to request headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", dbUser.id);
    requestHeaders.set("x-user-role", role);
    requestHeaders.set("x-user-email", dbUser.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error("Error in unified middleware:", error);
    return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto las que empiecen con:
     * - api (rutas API)
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (favicon)
     * - public (archivos públicos)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
