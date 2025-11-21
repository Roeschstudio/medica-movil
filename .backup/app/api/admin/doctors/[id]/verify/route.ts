import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { isVerified } = await request.json();
    const doctorId = params.id;

    // Verificar que el usuario existe y es doctor
    const user = await prisma.user.findUnique({
      where: { id: doctorId },
      include: { doctorProfile: true }
    });

    if (!user || user.role !== 'DOCTOR' || !user.doctorProfile) {
      return NextResponse.json(
        { error: 'Doctor no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar estado de verificación
    const updatedDoctor = await prisma.doctor.update({
      where: { userId: doctorId },
      data: { isVerified: Boolean(isVerified) }
    });

    return NextResponse.json({
      message: `Doctor ${isVerified ? 'verificado' : 'desverificado'} exitosamente`,
      doctor: updatedDoctor
    });

  } catch (error) {
    console.error('Error updating doctor verification:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}