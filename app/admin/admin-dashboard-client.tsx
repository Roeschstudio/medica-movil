
'use client';

import { useState, useEffect } from 'react';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Star,
  Clock,
  AlertCircle
} from 'lucide-react';
import { formatMexicanCurrency } from '@/lib/mexican-utils';

interface DashboardStats {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  averageRating: number;
  totalReviews: number;
}

export default function AdminDashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    setIsLoading(true);
    
    try {
      // TODO: Implementar API real para estadísticas
      // Por ahora usamos datos simulados
      const mockStats: DashboardStats = {
        totalUsers: 1247,
        totalDoctors: 87,
        totalPatients: 1160,
        totalAppointments: 2834,
        pendingAppointments: 23,
        completedAppointments: 2651,
        totalRevenue: 284570000, // en centavos
        monthlyRevenue: 45678900, // en centavos
        averageRating: 4.7,
        totalReviews: 1834
      };

      // Simular delay
      setTimeout(() => {
        setStats(mockStats);
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      setIsLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    description, 
    icon: Icon, 
    trend,
    trendValue 
  }: {
    title: string;
    value: string | number;
    description: string;
    icon: any;
    trend?: 'up' | 'down';
    trendValue?: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center space-x-2">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && trendValue && (
            <div className={`flex items-center space-x-1 ${
              trend === 'up' ? 'text-success' : 'text-destructive'
            }`}>
              {trend === 'up' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span className="text-xs font-medium">{trendValue}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        
        <div className="flex-1 bg-muted/30">
          <div className="max-width-container py-8">
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Dashboard Administrativo</h1>
                <p className="text-muted-foreground">
                  Gestión y estadísticas de la plataforma Medica Movil
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        
        <div className="flex-1 bg-muted/30">
          <div className="max-width-container py-8">
            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Error al cargar estadísticas
                </h3>
                <p className="text-muted-foreground mb-4">
                  No se pudieron cargar las estadísticas del dashboard
                </p>
                <Button onClick={loadDashboardStats}>
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      <div className="flex-1 bg-muted/30">
        <div className="max-width-container py-8">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard Administrativo</h1>
              <p className="text-muted-foreground">
                Gestión y estadísticas de la plataforma Medica Movil
              </p>
            </div>

            {/* Estadísticas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Usuarios"
                value={stats.totalUsers.toLocaleString()}
                description={`${stats.totalDoctors} doctores, ${stats.totalPatients} pacientes`}
                icon={Users}
                trend="up"
                trendValue="+12%"
              />
              
              <StatCard
                title="Citas Este Mes"
                value={stats.totalAppointments.toLocaleString()}
                description={`${stats.pendingAppointments} pendientes`}
                icon={Calendar}
                trend="up"
                trendValue="+8%"
              />

              <StatCard
                title="Ingresos Mensuales"
                value={formatMexicanCurrency(stats.monthlyRevenue)}
                description="Total este mes"
                icon={DollarSign}
                trend="up"
                trendValue="+15%"
              />

              <StatCard
                title="Calificación Promedio"
                value={`${stats.averageRating}/5`}
                description={`${stats.totalReviews} reseñas totales`}
                icon={Star}
                trend="up"
                trendValue="+0.1"
              />
            </div>

            {/* Tabs de gestión */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">
                  <Activity className="h-4 w-4 mr-2" />
                  Resumen
                </TabsTrigger>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 mr-2" />
                  Usuarios
                </TabsTrigger>
                <TabsTrigger value="appointments">
                  <Calendar className="h-4 w-4 mr-2" />
                  Citas
                </TabsTrigger>
                <TabsTrigger value="reports">
                  <FileText className="h-4 w-4 mr-2" />
                  Reportes
                </TabsTrigger>
              </TabsList>

              {/* Tab: Resumen */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Estadísticas adicionales */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Estadísticas Generales</CardTitle>
                      <CardDescription>
                        Métricas clave de la plataforma
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Citas completadas</span>
                        <Badge variant="outline">{stats.completedAppointments}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Ingresos totales</span>
                        <Badge variant="outline">{formatMexicanCurrency(stats.totalRevenue)}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Doctores activos</span>
                        <Badge variant="outline">{stats.totalDoctors}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Pacientes registrados</span>
                        <Badge variant="outline">{stats.totalPatients}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Acciones rápidas */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Acciones Rápidas</CardTitle>
                      <CardDescription>
                        Herramientas de administración
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button className="w-full justify-start" variant="outline">
                        <Users className="h-4 w-4 mr-2" />
                        Gestionar Usuarios
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Verificar Doctores
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <Calendar className="h-4 w-4 mr-2" />
                        Ver Citas Pendientes
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <FileText className="h-4 w-4 mr-2" />
                        Generar Reportes
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Otros tabs con contenido placeholder */}
              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>
                      Administrar doctores y pacientes registrados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Funcionalidad de gestión de usuarios próximamente
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="appointments">
                <Card>
                  <CardHeader>
                    <CardTitle>Gestión de Citas</CardTitle>
                    <CardDescription>
                      Supervisar y administrar todas las citas médicas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Panel de gestión de citas próximamente
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reports">
                <Card>
                  <CardHeader>
                    <CardTitle>Reportes y Analíticas</CardTitle>
                    <CardDescription>
                      Generar reportes de actividad y métricas de negocio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Sistema de reportes próximamente
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
