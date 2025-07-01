
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './admin-dashboard-client';

export default async function AdminDashboardPage() {
  const session = await getServerSession(authConfig);
  
  if (!session) {
    redirect('/iniciar-sesion');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  return <AdminDashboardClient />;
}
