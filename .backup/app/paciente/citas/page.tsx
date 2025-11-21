
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { redirect } from 'next/navigation';
import PatientAppointmentsClient from './patient-appointments-client';

export default async function PatientAppointmentsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/iniciar-sesion');
  }

  if (session.user.role !== 'PATIENT') {
    redirect('/unauthorized');
  }

  return <PatientAppointmentsClient />;
}
