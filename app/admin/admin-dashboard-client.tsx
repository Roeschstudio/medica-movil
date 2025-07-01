'use client';

import { useState, useEffect } from 'react';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { formatMexicanCurrency } from '@/lib/mexican-utils';
import { useToast } from '@/hooks/use-toast';

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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  createdAt: string;
  doctor?: {
    specialty: string;
    isVerified: boolean;
    city: string;
    state: string;
  };
}

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  consultationType: string;
  notes?: string;
  createdAt: string;
  patient: {
    id: string;
    name: string;
    email: string;
  };
  doctor: {
    id: string;
    name: string;
    specialty: string;
  };
}

export default function AdminDashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  
  // Filtros y paginación para usuarios
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  
  // Filtros y paginación para citas
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('all');
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [appointmentPagination, setAppointmentPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  const { toast } = useToast();

  useEffect(() => {
    loadDashboardStats();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [userSearch, userRole, userPage]);

  useEffect(() => {
    loadAppointments();
  }, [appointmentSearch, appointmentStatus, appointmentPage]);

  const loadDashboardStats = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/stats');
      
      if (!response.ok) {
        throw new Error('Error al cargar estadísticas');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: userPage.toString(),
        limit: '10',
        ...(userRole !== 'all' && { role: userRole }),
        ...(userSearch && { search: userSearch })
      });

      const response = await fetch(`/api/admin/users?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar usuarios');
      }
      
      const data = await response.json();
      setUsers(data.users);
      setUserPagination(data.pagination);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAppointments = async () => {
    setAppointmentsLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: appointmentPage.toString(),
        limit: '10',
        ...(appointmentStatus !== 'all' && { status: appointmentStatus }),
        ...(appointmentSearch && { search: appointmentSearch })
      });

      const response = await fetch(`/api/admin/appointments?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar citas');
      }
      
      const data = await response.json();
      setAppointments(data.appointments);
      setAppointmentPagination(data.pagination);
    } catch (error) {
      console.error('Error loading appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive",
      });
    } finally {
      setAppointmentsLoading(false);
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

  const toggleDoctorVerification = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/doctors/${userId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isVerified: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar verificación');
      }

      toast({
        title: "Éxito",
        description: `Doctor ${!currentStatus ? 'verificado' : 'desverificado'} correctamente`,
      });

      // Recargar usuarios
      await loadUsers();
    } catch (error) {
      console.error('Error toggling doctor verification:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la verificación del doctor",
        variant: "destructive",
      });
    }
  };

  const generateReport = async (type: string) => {
    try {
      toast({
        title: "Generando reporte",
        description: "Por favor espera mientras se genera el reporte...",
      });

      const response = await fetch(`/api/admin/reports?type=${type}`);
      
      if (!response.ok) {
        throw new Error('Error al generar reporte');
      }
      
      const data = await response.json();
      
      // Convertir a CSV y descargar
      const csvContent = convertToCSV(data);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte_${type}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Éxito",
        description: "Reporte generado y descargado correctamente",
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el reporte",
        variant: "destructive",
      });
    }
  };

  const convertToCSV = (reportData: any) => {
    if (!reportData.data || reportData.data.length === 0) {
      return 'No hay datos disponibles';
    }

    const headers = Object.keys(reportData.data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = reportData.data.map((row: any) => {
      return headers.map(header => {
        const value = row[header];
        // Escapar comillas y comas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  };

  const UserRow = ({ user }: { user: User }) => (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{user.name}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={
          user.role === 'ADMIN' ? 'destructive' : 
          user.role === 'DOCTOR' ? 'default' : 
          'secondary'
        }>
          {user.role === 'ADMIN' ? 'Admin' : 
           user.role === 'DOCTOR' ? 'Doctor' : 
           'Paciente'}
        </Badge>
      </TableCell>
      <TableCell>
        {user.doctor ? (
          <div>
            <div className="text-sm">{user.doctor.specialty}</div>
            <div className="text-xs text-muted-foreground">
              {user.doctor.city}, {user.doctor.state}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {user.doctor ? (
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={
              user.doctor.isVerified ? "text-success border-success" : "text-warning border-warning"
            }>
              {user.doctor.isVerified ? (
                <>
                  <UserCheck className="h-3 w-3 mr-1" />
                  Verificado
                </>
              ) : (
                <>
                  <UserX className="h-3 w-3 mr-1" />
                  Pendiente
                </>
              )}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleDoctorVerification(user.id, user.doctor!.isVerified)}
            >
              {user.doctor.isVerified ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle className="h-4 w-4 text-success" />
              )}
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {new Date(user.createdAt).toLocaleDateString('es-MX')}
        </div>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );

  const AppointmentRow = ({ appointment }: { appointment: Appointment }) => (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{appointment.patient.name}</div>
          <div className="text-sm text-muted-foreground">{appointment.patient.email}</div>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{appointment.doctor.name}</div>
          <div className="text-sm text-muted-foreground">{appointment.doctor.specialty}</div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {new Date(appointment.scheduledAt).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={
          appointment.status === 'COMPLETED' ? 'default' :
          appointment.status === 'PENDING' ? 'secondary' :
          appointment.status === 'CANCELLED' ? 'destructive' :
          'outline'
        }>
          {appointment.status === 'COMPLETED' ? 'Completada' :
           appointment.status === 'PENDING' ? 'Pendiente' :
           appointment.status === 'CANCELLED' ? 'Cancelada' :
           appointment.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {appointment.consultationType === 'IN_PERSON' ? 'Presencial' :
           appointment.consultationType === 'VIRTUAL' ? 'Virtual' :
           appointment.consultationType === 'HOME_VISIT' ? 'Domicilio' :
           appointment.consultationType}
        </Badge>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );

  const Pagination = ({ 
    pagination, 
    onPageChange 
  }: { 
    pagination: any, 
    onPageChange: (page: number) => void 
  }) => (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} resultados
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <div className="text-sm">
          Página {pagination.page} de {pagination.pages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.pages}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
                value={`${stats.averageRating.toFixed(1)}/5`}
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
                      <Button 
                        className="w-full justify-start" 
                        variant="outline"
                        onClick={() => {
                          // Cambiar a tab de usuarios
                          const usersTab = document.querySelector('[value="users"]') as HTMLElement;
                          usersTab?.click();
                        }}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Gestionar Usuarios
                      </Button>
                      <Button 
                        className="w-full justify-start" 
                        variant="outline"
                        onClick={() => {
                          setUserRole('DOCTOR');
                          const usersTab = document.querySelector('[value="users"]') as HTMLElement;
                          usersTab?.click();
                        }}
                      >
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Verificar Doctores
                      </Button>
                      <Button 
                        className="w-full justify-start" 
                        variant="outline"
                        onClick={() => {
                          setAppointmentStatus('PENDING');
                          const appointmentsTab = document.querySelector('[value="appointments"]') as HTMLElement;
                          appointmentsTab?.click();
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Ver Citas Pendientes
                      </Button>
                      <Button 
                        className="w-full justify-start" 
                        variant="outline"
                        onClick={() => {
                          const reportsTab = document.querySelector('[value="reports"]') as HTMLElement;
                          reportsTab?.click();
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generar Reportes
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab: Usuarios */}
              <TabsContent value="users" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>
                      Administrar doctores y pacientes registrados
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filtros */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nombre o email..."
                          value={userSearch}
                          onChange={(e) => {
                            setUserSearch(e.target.value);
                            setUserPage(1);
                          }}
                          className="pl-10"
                        />
                      </div>
                      <Select 
                        value={userRole} 
                        onValueChange={(value) => {
                          setUserRole(value);
                          setUserPage(1);
                        }}
                      >
                        <SelectTrigger className="w-full sm:w-48">
                          <SelectValue placeholder="Filtrar por rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los roles</SelectItem>
                          <SelectItem value="PATIENT">Pacientes</SelectItem>
                          <SelectItem value="DOCTOR">Doctores</SelectItem>
                          <SelectItem value="ADMIN">Administradores</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tabla de usuarios */}
                    {usersLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Usuario</TableHead>
                              <TableHead>Rol</TableHead>
                              <TableHead>Especialidad/Ubicación</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Fecha de registro</TableHead>
                              <TableHead>Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.map((user) => (
                              <UserRow key={user.id} user={user} />
                            ))}
                          </TableBody>
                        </Table>

                        {/* Paginación */}
                        <Pagination 
                          pagination={userPagination}
                          onPageChange={setUserPage}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Citas */}
              <TabsContent value="appointments" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Gestión de Citas</CardTitle>
                    <CardDescription>
                      Supervisar y administrar todas las citas médicas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filtros */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por paciente o doctor..."
                          value={appointmentSearch}
                          onChange={(e) => {
                            setAppointmentSearch(e.target.value);
                            setAppointmentPage(1);
                          }}
                          className="pl-10"
                        />
                      </div>
                      <Select 
                        value={appointmentStatus} 
                        onValueChange={(value) => {
                          setAppointmentStatus(value);
                          setAppointmentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-full sm:w-48">
                          <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          <SelectItem value="PENDING">Pendientes</SelectItem>
                          <SelectItem value="CONFIRMED">Confirmadas</SelectItem>
                          <SelectItem value="COMPLETED">Completadas</SelectItem>
                          <SelectItem value="CANCELLED">Canceladas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tabla de citas */}
                    {appointmentsLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Paciente</TableHead>
                              <TableHead>Doctor</TableHead>
                              <TableHead>Fecha y hora</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {appointments.map((appointment) => (
                              <AppointmentRow key={appointment.id} appointment={appointment} />
                            ))}
                          </TableBody>
                        </Table>

                        {/* Paginación */}
                        <Pagination 
                          pagination={appointmentPagination}
                          onPageChange={setAppointmentPage}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Reportes */}
              <TabsContent value="reports" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reportes y Analíticas</CardTitle>
                    <CardDescription>
                      Generar reportes de actividad y métricas de negocio
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button 
                        className="h-24 flex-col space-y-2" 
                        variant="outline"
                        onClick={() => generateReport('users')}
                      >
                        <FileText className="h-6 w-6" />
                        <span>Reporte de Usuarios</span>
                        <span className="text-xs text-muted-foreground">Exportar lista de usuarios</span>
                      </Button>
                      
                      <Button 
                        className="h-24 flex-col space-y-2" 
                        variant="outline"
                        onClick={() => generateReport('appointments')}
                      >
                        <Calendar className="h-6 w-6" />
                        <span>Reporte de Citas</span>
                        <span className="text-xs text-muted-foreground">Exportar historial de citas</span>
                      </Button>
                      
                      <Button 
                        className="h-24 flex-col space-y-2" 
                        variant="outline"
                        onClick={() => generateReport('financial')}
                      >
                        <DollarSign className="h-6 w-6" />
                        <span>Reporte Financiero</span>
                        <span className="text-xs text-muted-foreground">Análisis de ingresos</span>
                      </Button>
                      
                      <Button 
                        className="h-24 flex-col space-y-2" 
                        variant="outline"
                        onClick={() => generateReport('activity')}
                      >
                        <Activity className="h-6 w-6" />
                        <span>Reporte de Actividad</span>
                        <span className="text-xs text-muted-foreground">Métricas de uso</span>
                      </Button>
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
