
import Link from 'next/link';
import { Heart, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-muted border-t border-border">
      <div className="max-width-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo y descripción */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Heart className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">
                Medica <span className="text-primary">Movil</span>
              </span>
            </Link>
            <p className="text-muted-foreground mb-4 max-w-md">
              La plataforma líder en México para encontrar y agendar citas médicas. 
              Conectamos pacientes con los mejores especialistas del país.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Ciudad de México, México</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>contacto@medicamovil.mx</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span>+52 55 1234 5678</span>
              </div>
            </div>
          </div>

          {/* Para Pacientes */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Para Pacientes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/servicios" className="hover:text-primary transition-colors">
                  Servicios
                </Link>
              </li>
              <li>
                <Link href="/buscar" className="hover:text-primary transition-colors">
                  Buscar Doctores
                </Link>
              </li>
              <li>
                <Link href="/registrarse" className="hover:text-primary transition-colors">
                  Crear Cuenta
                </Link>
              </li>
              <li>
                <Link href="/sobre-nosotros" className="hover:text-primary transition-colors">
                  Sobre Nosotros
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="hover:text-primary transition-colors">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          {/* Para Doctores */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Para Doctores</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/doctor/registro" className="hover:text-primary transition-colors">
                  Registrar Consulta
                </Link>
              </li>
              <li>
                <Link href="/iniciar-sesion" className="hover:text-primary transition-colors">
                  Iniciar Sesión
                </Link>
              </li>
              <li>
                <Link href="/beneficios-doctores" className="hover:text-primary transition-colors">
                  Beneficios
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Medica Movil. Todos los derechos reservados.</p>
          <p className="mt-2">
            Desarrollado con ❤️ para mejorar el acceso a la salud en México
          </p>
        </div>
      </div>
    </footer>
  );
}
