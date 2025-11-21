'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSocket } from '@/lib/socket-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Users,
  MessageSquare,
  Video,
  DollarSign,
  Activity,
  Search,
  Eye,
  TrendingUp,
  UserCheck,
  FileText
} from 'lucide-react';
import { redirect } from 'next/navigation';

interface DashboardStats {
  totalUsers: number;
  activeChats: number;
  activeCalls: number;
  totalRevenue: number;
  pendingPayments: number;
  onlineDoctors: number;
  onlinePatients: number;
}

interface ChatRoom {
  id: string;
  status: 'active' | 'ended' | 'pending';
  type: 'consultation' | 'follow_up' | 'emergency';
  lastActivity: string;
  unreadCount: number;
  appointment: {
    id: string;
    scheduledAt: string;
    doctor: {
      id: string;
      name: string;
      image?: string;
      specialty: string;
    };
    patient: {
      id: string;
      name: string;
      image?: string;
    };
  };
}

interface VideoSession {
  id: string;
  status: 'active' | 'ended' | 'scheduled';
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  participants: {
    doctor: {
      id: string;
      name: string;
      image?: string;
    };
    patient: {
      id: string;
      name: string;
      image?: string;
    };
  };
}

interface PaymentDistribution {
  id: string;
  amount: number;
  doctorShare: number;
  platformFee: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  doctor: {
    id: string;
    name: string;
  };
  appointment: {
    id: string;
    scheduledAt: string;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeChats: 0,
    activeCalls: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    onlineDoctors: 0,
    onlinePatients: 0
  });
  
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [videoSessions, setVideoSessions] = useState<VideoSession[]>([]);
  const [paymentDistributions, setPaymentDistributions] = useState<PaymentDistribution[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  
  const { data: session } = useSession();
  const { socket, onUserConnected, onUserDisconnected } = useSocket();

  // Check admin access
  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      redirect('/unauthorized');
    }
  }, [session]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      // Load stats
      const statsResponse = await fetch('/api/admin/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
      
      // Load chat rooms
      const chatResponse = await fetch('/api/admin/chat/rooms');
      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        setChatRooms(chatData.rooms || []);
      }
      
      // Load video sessions
      const videoResponse = await fetch('/api/admin/video/sessions');
      if (videoResponse.ok) {
        const videoData = await videoResponse.json();
        setVideoSessions(videoData.sessions || []);
      }
      
      // Load payment distributions
      const paymentsResponse = await fetch('/api/admin/payments/distribute');
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        setPaymentDistributions(paymentsData.distributions || []);
      }
      
    } catch (_error) {
        toast.error('Failed to load dashboard data');
      }
  }, []);

  useEffect(() => {
    if (session?.user.role === 'ADMIN') {
      loadDashboardData();
    }
  }, [session, loadDashboardData]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleUserConnected = (data: { userId: string; userType: string }) => {
      setStats(prev => ({
        ...prev,
        onlineDoctors: data.userType === 'doctor' ? prev.onlineDoctors + 1 : prev.onlineDoctors,
        onlinePatients: data.userType === 'patient' ? prev.onlinePatients + 1 : prev.onlinePatients
      }));
    };

    const handleUserDisconnected = (data: { userId: string; userType: string }) => {
      setStats(prev => ({
        ...prev,
        onlineDoctors: data.userType === 'doctor' ? Math.max(0, prev.onlineDoctors - 1) : prev.onlineDoctors,
        onlinePatients: data.userType === 'patient' ? Math.max(0, prev.onlinePatients - 1) : prev.onlinePatients
      }));
    };

    onUserConnected(handleUserConnected);
    onUserDisconnected(handleUserDisconnected);

    return () => {
      socket.off('user_connected', handleUserConnected);
      socket.off('user_disconnected', handleUserDisconnected);
    };
  }, [socket, onUserConnected, onUserDisconnected]);

  // Filter chat rooms
  const filteredChatRooms = chatRooms.filter(room => {
    const matchesSearch = searchTerm === '' || 
      room.appointment.doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.appointment.patient.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'ended':
        return <Badge variant="secondary">Ended</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (session?.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Activity className="h-3 w-3" />
            <span>Live</span>
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <UserCheck className="h-3 w-3 text-green-500" />
              <span>{stats.onlineDoctors} doctors, {stats.onlinePatients} patients online</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeChats}</div>
            <p className="text-xs text-muted-foreground">
              Real-time conversations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Video Calls</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCalls}</div>
            <p className="text-xs text-muted-foreground">
              Active video sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span>{stats.pendingPayments} pending payments</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="chats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chats">Chat Monitoring</TabsTrigger>
          <TabsTrigger value="videos">Video Sessions</TabsTrigger>
          <TabsTrigger value="payments">Payment Management</TabsTrigger>
        </TabsList>

        {/* Chat Monitoring */}
        <TabsContent value="chats" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Chat Rooms</CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search chats..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredChatRooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex -space-x-2">
                        <Avatar className="border-2 border-white">
                          <AvatarImage src={room.appointment.doctor.image} alt={`Dr. ${room.appointment.doctor.name} profile picture`} />
                          <AvatarFallback>
                            {room.appointment.doctor.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <Avatar className="border-2 border-white">
                          <AvatarImage src={room.appointment.patient.image} alt={`${room.appointment.patient.name} profile picture`} />
                          <AvatarFallback>
                            {room.appointment.patient.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      
                      <div>
                        <p className="font-medium">
                          Dr. {room.appointment.doctor.name} & {room.appointment.patient.name}
                        </p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <span>{room.appointment.doctor.specialty}</span>
                          <span>•</span>
                          <span>{new Date(room.lastActivity).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(room.status)}
                      
                      {room.unreadCount > 0 && (
                        <Badge variant="destructive" className="rounded-full">
                          {room.unreadCount}
                        </Badge>
                      )}
                      
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {filteredChatRooms.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No chat rooms found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video Sessions */}
        <TabsContent value="videos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Video Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {videoSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex -space-x-2">
                        <Avatar className="border-2 border-white">
                          <AvatarImage src={session.participants.doctor.image} alt={`Dr. ${session.participants.doctor.name} profile picture`} />
                          <AvatarFallback>
                            {session.participants.doctor.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <Avatar className="border-2 border-white">
                          <AvatarImage src={session.participants.patient.image} alt={`${session.participants.patient.name} profile picture`} />
                          <AvatarFallback>
                            {session.participants.patient.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      
                      <div>
                        <p className="font-medium">
                          Dr. {session.participants.doctor.name} & {session.participants.patient.name}
                        </p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          {session.startedAt && (
                            <span>{new Date(session.startedAt).toLocaleString()}</span>
                          )}
                          {session.duration && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(session.duration)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(session.status)}
                      
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {videoSessions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No video sessions found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Management */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Distributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentDistributions.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      
                      <div>
                        <p className="font-medium">Dr. {payment.doctor.name}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <span>{formatCurrency(payment.amount)} total</span>
                          <span>•</span>
                          <span>{formatCurrency(payment.doctorShare)} doctor</span>
                          <span>•</span>
                          <span>{formatCurrency(payment.platformFee)} platform</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(payment.status)}
                      
                      <span className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </span>
                      
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {paymentDistributions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No payment distributions found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}