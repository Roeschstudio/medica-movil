'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus
} from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  appointment: {
    id: string;
    scheduledAt: string;
    patient: {
      name: string;
      email: string;
    };
  };
  paymentDistributions: {
    id: string;
    amount: number;
    status: string;
  }[];
}

interface EarningsSummary {
  totalEarnings: number;
  totalTransactions: number;
  distributedEarnings: number;
  distributedTransactions: number;
  pendingAmount: number;
}

interface MonthlyEarning {
  month: string;
  earnings: number;
  transactions: number;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string;
  requestedAt: string;
  processedAt?: string;
}

interface EarningsData {
  payments: Payment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  summary: EarningsSummary;
  monthlyEarnings: MonthlyEarning[];
  pendingWithdrawals: Withdrawal[];
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800'
};

const STATUS_ICONS = {
  PENDING: Clock,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
  REFUNDED: AlertCircle
};

export default function DoctorEarnings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    paymentMethod: '',
    accountDetails: ''
  });
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    page: 1,
    limit: 10
  });

  const loadEarningsData = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });

      const response = await fetch(`/api/doctor/earnings?${queryParams}`);
      
      if (response.ok) {
        const data = await response.json();
        setEarningsData(data.data);
      } else {
        toast.error('Error al cargar los datos de ganancias');
      }
    } catch (_error) {
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadWithdrawals = useCallback(async () => {
    try {
      const response = await fetch('/api/doctor/earnings', {
        method: 'PATCH'
      });
      
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data.withdrawals);
      }
    } catch (_error) {
      // Error loading withdrawals - silent fail
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'DOCTOR') {
      router.push('/auth/signin');
      return;
    }

    loadEarningsData();
    loadWithdrawals();
  }, [session, status, router, loadEarningsData, loadWithdrawals]);

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWithdrawal(true);

    try {
      const response = await fetch('/api/doctor/earnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawalForm.amount),
          paymentMethod: withdrawalForm.paymentMethod,
          accountDetails: withdrawalForm.accountDetails
        })
      });

      if (response.ok) {
        toast.success('Solicitud de retiro enviada correctamente');
        setShowWithdrawalDialog(false);
        setWithdrawalForm({ amount: '', paymentMethod: '', accountDetails: '' });
        loadEarningsData();
        loadWithdrawals();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al procesar la solicitud');
      }
    } catch (_error) {
      toast.error('Error al enviar la solicitud');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || AlertCircle;
    return <Icon className="h-4 w-4" />;
  };

  const availableBalance = earningsData ? 
    earningsData.summary.distributedEarnings - 
    withdrawals.filter(w => ['PENDING', 'COMPLETED'].includes(w.status))
      .reduce((sum, w) => sum + w.amount, 0) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Ganancias</h1>
        <p className="text-gray-600 mt-2">Gestiona tus ingresos y retiros</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ganancias Totales</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earningsData?.summary.totalEarnings || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Distribuido</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earningsData?.summary.distributedEarnings || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Disponible</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(availableBalance)}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Transacciones</p>
                <p className="text-2xl font-bold text-gray-900">
                  {earningsData?.summary.totalTransactions || 0}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
            <TabsTrigger value="withdrawals">Retiros</TabsTrigger>
          </TabsList>

          <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Solicitar Retiro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar Retiro</DialogTitle>
                <DialogDescription>
                  Disponible para retiro: {formatCurrency(availableBalance)}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="amount">Monto</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="1"
                    max={availableBalance}
                    value={withdrawalForm.amount}
                    onChange={(e) => setWithdrawalForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Método de Pago</Label>
                  <Select
                    value={withdrawalForm.paymentMethod}
                    onValueChange={(value) => setWithdrawalForm(prev => ({ ...prev, paymentMethod: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Transferencia Bancaria</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="accountDetails">Detalles de Cuenta</Label>
                  <Input
                    id="accountDetails"
                    value={withdrawalForm.accountDetails}
                    onChange={(e) => setWithdrawalForm(prev => ({ ...prev, accountDetails: e.target.value }))}
                    placeholder="Número de cuenta, email, etc."
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={submittingWithdrawal} className="flex-1">
                    {submittingWithdrawal ? 'Procesando...' : 'Solicitar Retiro'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowWithdrawalDialog(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Monthly Earnings Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Ganancias Mensuales</CardTitle>
                <CardDescription>Últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {earningsData?.monthlyEarnings.map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">
                          {new Date(month.month).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-sm text-gray-600">{month.transactions} transacciones</p>
                      </div>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(month.earnings)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pending Withdrawals */}
            <Card>
              <CardHeader>
                <CardTitle>Retiros Pendientes</CardTitle>
                <CardDescription>Solicitudes en proceso</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {earningsData?.pendingWithdrawals.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No hay retiros pendientes</p>
                  ) : (
                    earningsData?.pendingWithdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{formatCurrency(withdrawal.amount)}</p>
                          <p className="text-sm text-gray-600">
                            {formatDate(withdrawal.payment.appointment.scheduledAt)}
                          </p>
                        </div>
                        <Badge className={STATUS_COLORS[withdrawal.status as keyof typeof STATUS_COLORS]}>
                          {getStatusIcon(withdrawal.status)}
                          <span className="ml-1">{withdrawal.status}</span>
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Pagos</CardTitle>
              <CardDescription>Todos los pagos recibidos</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="startDate">Fecha Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate">Fecha Fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value, page: 1 }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="PENDING">Pendiente</SelectItem>
                      <SelectItem value="COMPLETED">Completado</SelectItem>
                      <SelectItem value="FAILED">Fallido</SelectItem>
                      <SelectItem value="REFUNDED">Reembolsado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Payments List */}
              <div className="space-y-4">
                {earningsData?.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{payment.appointment.patient.name}</p>
                          <p className="text-sm text-gray-600">
                            {formatDate(payment.appointment.scheduledAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(payment.amount)}</p>
                      <Badge className={STATUS_COLORS[payment.status as keyof typeof STATUS_COLORS]}>
                        {getStatusIcon(payment.status)}
                        <span className="ml-1">{payment.status}</span>
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {earningsData && earningsData.pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-gray-600">
                    Mostrando {((earningsData.pagination.page - 1) * earningsData.pagination.limit) + 1} a{' '}
                    {Math.min(earningsData.pagination.page * earningsData.pagination.limit, earningsData.pagination.total)} de{' '}
                    {earningsData.pagination.total} resultados
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={earningsData.pagination.page === 1}
                      onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={earningsData.pagination.page === earningsData.pagination.pages}
                      onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Retiros</CardTitle>
              <CardDescription>Todas las solicitudes de retiro</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {withdrawals.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay retiros registrados</p>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{formatCurrency(withdrawal.amount)}</p>
                        <p className="text-sm text-gray-600">
                          {withdrawal.paymentMethod} • {formatDate(withdrawal.requestedAt)}
                        </p>
                        {withdrawal.processedAt && (
                          <p className="text-xs text-gray-500">
                            Procesado: {formatDate(withdrawal.processedAt)}
                          </p>
                        )}
                      </div>
                      
                      <Badge className={STATUS_COLORS[withdrawal.status as keyof typeof STATUS_COLORS]}>
                        {getStatusIcon(withdrawal.status)}
                        <span className="ml-1">{withdrawal.status}</span>
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}