
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { DoctorProfileClient } from './doctor-profile-client';

async function getDoctorProfile(id: string) {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/doctors/${id}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return null;
  }
}

export default async function DoctorProfilePage({
  params
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authConfig);
  
  if (!session) {
    redirect('/iniciar-sesion');
  }

  const doctor = await getDoctorProfile(params.id);
  
  if (!doctor) {
    notFound();
  }

  return <DoctorProfileClient doctor={doctor} />;
}
