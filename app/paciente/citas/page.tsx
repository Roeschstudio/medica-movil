
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { redirect } from 'next/navigation';
import PatientAppointmentsClient from './patient-appointments-client';

export default async function PatientAppointmentsPage() {
  const session = await getServerSession(authConfig);
  
  if (!session) {
    redirect('/iniciar-sesion');
  }

  if (session.user.role !== 'PATIENT') {
    redirect('/unauthorized');
  }

  return <PatientAppointmentsClient />;
}
