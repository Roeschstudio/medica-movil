import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener estadísticas reales de la base de datos
    const [
      totalUsers,
      totalDoctors,
      totalPatients,
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      avgRating,
      totalReviews
    ] = await Promise.all([
      // Total de usuarios
      prisma.user.count(),
      
      // Total de doctores
      prisma.user.count({
        where: { role: 'DOCTOR' }
      }),
      
      // Total de pacientes
      prisma.user.count({
        where: { role: 'PATIENT' }
      }),
      
      // Total de citas
      prisma.appointment.count(),
      
      // Citas pendientes
      prisma.appointment.count({
        where: { status: 'PENDING' }
      }),
      
      // Citas completadas
      prisma.appointment.count({
        where: { status: 'COMPLETED' }
      }),
      
      // Rating promedio
      prisma.review.aggregate({
        _avg: { rating: true }
      }),
      
      // Total de reseñas
      prisma.review.count()
    ]);

    // Calcular ingresos (simulado por ahora, ya que no tenemos pagos reales)
    const completedAppointmentsWithPrice = await prisma.appointment.findMany({
      where: { status: 'COMPLETED' },
      include: {
        doctor: {
          select: {
            priceInPerson: true,
            priceVirtual: true,
            priceHomeVisit: true
          }
        }
      }
    });

    let totalRevenue = 0;
    let monthlyRevenue = 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    completedAppointmentsWithPrice.forEach((appointment: any) => {
      // Usar precio promedio basado en tipo de consulta
      const avgPrice = 800; // Precio promedio en pesos (800 MXN)
      totalRevenue += avgPrice * 100; // Convertir a centavos
      
      const appointmentDate = new Date(appointment.scheduledAt);
      if (appointmentDate.getMonth() === currentMonth && 
          appointmentDate.getFullYear() === currentYear) {
        monthlyRevenue += avgPrice * 100;
      }
    });

    const stats = {
      totalUsers,
      totalDoctors,
      totalPatients,
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      totalRevenue,
      monthlyRevenue,
      averageRating: avgRating._avg.rating || 0,
      totalReviews
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 