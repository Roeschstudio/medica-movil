
'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { 
  Heart,
  Menu,
  X,
  User,
  Calendar,
  Settings,
  LogOut,
  Stethoscope,
  UserPlus
} from 'lucide-react';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function MainNav() {
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const getDashboardLink = () => {
    if (!session?.user) return '/';
    
    switch (session.user.role) {
      case 'ADMIN':
        return '/admin';
      case 'DOCTOR':
        return '/doctor/agenda';
      case 'PATIENT':
        return '/paciente/citas';
      default:
        return '/';
    }
  };

  const getUserDisplayName = () => {
    if (!session?.user) return '';
    return session.user.name.split(' ')[0]; // Solo el primer nombre
  };

  return (
    <nav className="sticky-nav">
      <div className="max-width-container">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Heart className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">
              Medica <span className="text-primary">Movil</span>
            </span>
          </Link>

          {/* Navegación desktop */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="/servicios"
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Servicios
            </Link>
            <Link
              href="/buscar"
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Buscar Doctores
            </Link>
            <Link
              href="/sobre-nosotros"
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Sobre Nosotros
            </Link>
            <Link
              href="/contacto"
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Contacto
            </Link>
            
            {session?.user ? (
              <div className="flex items-center space-x-4">
                {/* Botón para doctores no registrados */}
                {session.user.role === 'PATIENT' && (
                  <Link href="/doctor/registro">
                    <Button variant="outline" size="sm" className="flex items-center space-x-2">
                      <Stethoscope className="h-4 w-4" />
                      <span>Soy Doctor</span>
                    </Button>
                  </Link>
                )}

                {/* Menú de usuario */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>{getUserDisplayName()}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem asChild>
                      <Link href={getDashboardLink()} className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>
                          {session.user.role === 'DOCTOR' && 'Mi Agenda'}
                          {session.user.role === 'PATIENT' && 'Mis Citas'}
                          {session.user.role === 'ADMIN' && 'Dashboard'}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href={
                        session.user.role === 'ADMIN' ? '/admin/perfil' :
                        session.user.role === 'DOCTOR' ? '/doctor/perfil' :
                        '/paciente/perfil'
                      } className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Configuración</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={handleSignOut} className="flex items-center text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Cerrar Sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/doctor/registro">
                  <Button variant="outline" size="sm" className="flex items-center space-x-2">
                    <Stethoscope className="h-4 w-4" />
                    <span>Soy Doctor</span>
                  </Button>
                </Link>
                <Link href="/iniciar-sesion">
                  <Button variant="ghost" size="sm">
                    Iniciar Sesión
                  </Button>
                </Link>
                <Link href="/registrarse">
                  <Button size="sm" className="flex items-center space-x-2">
                    <UserPlus className="h-4 w-4" />
                    <span>Registrarse</span>
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Botón de menú móvil */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Menú móvil */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-sm">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                href="/servicios"
                className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Servicios
              </Link>
              <Link
                href="/buscar"
                className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Buscar Doctores
              </Link>
              <Link
                href="/sobre-nosotros"
                className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sobre Nosotros
              </Link>
              <Link
                href="/contacto"
                className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contacto
              </Link>
              
              {session?.user ? (
                <>
                  <Link
                    href={getDashboardLink()}
                    className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {session.user.role === 'DOCTOR' && 'Mi Agenda'}
                    {session.user.role === 'PATIENT' && 'Mis Citas'}
                    {session.user.role === 'ADMIN' && 'Dashboard'}
                  </Link>
                  
                  {session.user.role === 'PATIENT' && (
                    <Link
                      href="/doctor/registro"
                      className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Soy Doctor
                    </Link>
                  )}
                  
                  <Link
                    href={`/${session.user.role.toLowerCase()}/perfil`}
                    className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Configuración
                  </Link>
                  
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="block w-full text-left px-3 py-2 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/doctor/registro"
                    className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Soy Doctor
                  </Link>
                  <Link
                    href="/iniciar-sesion"
                    className="block px-3 py-2 text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    href="/registrarse"
                    className="block px-3 py-2 text-primary font-medium hover:text-primary/80 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Registrarse
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
