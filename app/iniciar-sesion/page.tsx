
'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Heart, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        toast({
          title: "Error al iniciar sesión",
          description: result.error,
          variant: "destructive",
        });
      } else {
        // Obtener la sesión actualizada para redirigir según el rol
        const session = await getSession();
        
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente",
        });

        // Redirigir según el rol del usuario
        if (session?.user?.role === 'ADMIN') {
          router.push('/admin');
        } else if (session?.user?.role === 'DOCTOR') {
          router.push('/doctor/agenda');
        } else if (session?.user?.role === 'PATIENT') {
          router.push('/paciente/citas');
        } else {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Error during sign in:', error);
      setError('Error inesperado. Por favor, intenta de nuevo.');
      toast({
        title: "Error",
        description: "Error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      <div className="flex-1 flex items-center justify-center bg-muted/30 py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Logo y título */}
          <div className="text-center">
            <Link href="/" className="inline-flex items-center space-x-2 mb-6">
              <Heart className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">
                Medica <span className="text-primary">Movil</span>
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">
              Iniciar Sesión
            </h1>
            <p className="text-muted-foreground mt-2">
              Accede a tu cuenta para gestionar tus citas médicas
            </p>
          </div>

          <Card className="medical-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-center">Ingresa tus datos</CardTitle>
              <CardDescription className="text-center">
                Usa tu email y contraseña para acceder
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="pl-10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tu contraseña"
                      className="pl-10 pr-10"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </Button>
              </form>

              {/* Cuenta demo */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-foreground mb-2">Cuenta de prueba:</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><strong>Admin:</strong> john@doe.com / johndoe123</p>
                  <p><strong>Paciente:</strong> maria.garcia@email.com / paciente123</p>
                  <p><strong>Doctor:</strong> dra.sofia.martinez@medico.com / doctor123</p>
                </div>
              </div>

              <div className="mt-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  ¿No tienes una cuenta?{' '}
                  <Link href="/registrarse" className="text-primary hover:underline font-medium">
                    Regístrate aquí
                  </Link>
                </p>
                <p className="text-sm text-muted-foreground">
                  ¿Eres doctor?{' '}
                  <Link href="/doctor/registro" className="text-secondary hover:underline font-medium">
                    Registra tu consulta
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}
