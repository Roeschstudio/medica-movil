
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Rutas públicas que no requieren autenticación
    const publicRoutes = [
      '/',
      '/buscar',
      '/doctores',
      '/iniciar-sesion',
      '/registrarse',
      '/auth/error',
      '/unauthorized'
    ];

    // Si es una ruta pública, permitir acceso
    if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Si no hay token y la ruta no es pública, redirigir al login
    if (!token) {
      return NextResponse.redirect(new URL('/iniciar-sesion', req.url));
    }

    // Rutas específicas por rol
    const role = token.role as UserRole;

    // Rutas de administrador
    if (pathname.startsWith('/admin')) {
      if (role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    // Rutas de doctor
    if (pathname.startsWith('/doctor')) {
      if (role !== UserRole.DOCTOR) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    // Rutas de paciente
    if (pathname.startsWith('/paciente')) {
      if (role !== UserRole.PATIENT) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Permitir acceso si hay token o si es una ruta pública
        const pathname = req.nextUrl.pathname;
        const publicRoutes = [
          '/',
          '/buscar',
          '/doctores',
          '/iniciar-sesion',
          '/registrarse',
          '/auth/error',
          '/unauthorized'
        ];

        return !!token || publicRoutes.some(route => 
          pathname === route || pathname.startsWith(route)
        );
      },
    },
  }
);

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
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
