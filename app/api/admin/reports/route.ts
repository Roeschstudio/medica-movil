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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'users':
        return await generateUsersReport();
      case 'appointments':
        return await generateAppointmentsReport();
      case 'financial':
        return await generateFinancialReport();
      case 'activity':
        return await generateActivityReport();
      default:
        return NextResponse.json(
          { error: 'Tipo de reporte no válido' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function generateUsersReport() {
  const users = await prisma.user.findMany({
    include: {
      doctorProfile: {
        select: {
          specialty: true,
          isVerified: true,
          city: true,
          state: true,
          priceInPerson: true,
          priceVirtual: true,
          priceHomeVisit: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const report = users.map((user: any) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    createdAt: user.createdAt.toISOString(),
    ...(user.doctorProfile && {
      specialty: user.doctorProfile.specialty,
      isVerified: user.doctorProfile.isVerified,
      location: `${user.doctorProfile.city}, ${user.doctorProfile.state}`,
      priceInPerson: user.doctorProfile.priceInPerson,
      priceVirtual: user.doctorProfile.priceVirtual,
      priceHomeVisit: user.doctorProfile.priceHomeVisit
    })
  }));

  return NextResponse.json({
    type: 'users',
    data: report,
    total: users.length,
    generatedAt: new Date().toISOString()
  });
}

async function generateAppointmentsReport() {
  const appointments = await prisma.appointment.findMany({
    include: {
      patient: {
        select: {
          name: true,
          email: true
        }
      },
      doctorProfile: {
        select: {
          specialty: true,
          user: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const report = appointments.map((appointment: any) => ({
    id: appointment.id,
    scheduledAt: appointment.scheduledAt.toISOString(),
    status: appointment.status,
    consultationType: appointment.type,
    patientName: appointment.patient.name,
    patientEmail: appointment.patient.email,
    doctorName: appointment.doctorProfile.user.name,
    doctorSpecialty: appointment.doctorProfile.specialty,
    notes: appointment.notes || '',
    createdAt: appointment.createdAt.toISOString()
  }));

  return NextResponse.json({
    type: 'appointments',
    data: report,
    total: appointments.length,
    generatedAt: new Date().toISOString()
  });
}

async function generateFinancialReport() {
  const completedAppointments = await prisma.appointment.findMany({
    where: { status: 'COMPLETED' },
    include: {
      patient: {
        select: {
          name: true
        }
      },
      doctorProfile: {
        select: {
          priceInPerson: true,
          priceVirtual: true,
          priceHomeVisit: true,
          user: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: { scheduledAt: 'desc' }
  });

  const report = completedAppointments.map((appointment: any) => {
    let estimatedRevenue = 800; // Precio base por defecto
    
    if (appointment.type === 'IN_PERSON' && appointment.doctorProfile.priceInPerson) {
      estimatedRevenue = appointment.doctorProfile.priceInPerson;
    } else if (appointment.type === 'VIRTUAL' && appointment.doctorProfile.priceVirtual) {
      estimatedRevenue = appointment.doctorProfile.priceVirtual;
    } else if (appointment.type === 'HOME_VISIT' && appointment.doctorProfile.priceHomeVisit) {
      estimatedRevenue = appointment.doctorProfile.priceHomeVisit;
    }

    return {
      appointmentId: appointment.id,
      date: appointment.scheduledAt.toISOString(),
      patientName: appointment.patient.name,
      doctorName: appointment.doctorProfile.user.name,
      consultationType: appointment.type,
      estimatedRevenue: estimatedRevenue,
      platformFee: Math.round(estimatedRevenue * 0.1), // 10% comisión
      createdAt: appointment.createdAt.toISOString()
    };
  });

  const totalRevenue = report.reduce((sum: number, item: any) => sum + item.estimatedRevenue, 0);
  const totalFees = report.reduce((sum: number, item: any) => sum + item.platformFee, 0);

  return NextResponse.json({
    type: 'financial',
    data: report,
    summary: {
      totalAppointments: report.length,
      totalRevenue: totalRevenue,
      totalPlatformFees: totalFees,
      averageRevenuePerAppointment: Math.round(totalRevenue / report.length) || 0
    },
    generatedAt: new Date().toISOString()
  });
}

async function generateActivityReport() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersLast30Days,
    newUsersLast7Days,
    totalAppointments,
    appointmentsLast30Days,
    appointmentsLast7Days,
    activeUsers,
    topSpecialties
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    }),
    prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    }),
    prisma.appointment.count(),
    prisma.appointment.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    }),
    prisma.appointment.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    }),
    prisma.user.count({
      where: {
        OR: [
          { 
            appointmentsAsPatient: {
              some: { createdAt: { gte: thirtyDaysAgo } }
            }
          },
          {
            doctorProfile: {
              appointments: {
                some: { createdAt: { gte: thirtyDaysAgo } }
              }
            }
          }
        ]
      }
    }),
    prisma.doctor.groupBy({
      by: ['specialty'],
      _count: {
        specialty: true
      },
      orderBy: {
        _count: {
          specialty: 'desc'
        }
      },
      take: 5
    })
  ]);

  return NextResponse.json({
    type: 'activity',
    data: {
      userActivity: {
        totalUsers,
        newUsersLast30Days,
        newUsersLast7Days,
        activeUsersLast30Days: activeUsers
      },
      appointmentActivity: {
        totalAppointments,
        appointmentsLast30Days,
        appointmentsLast7Days
      },
      topSpecialties: topSpecialties.map((item: any) => ({
        specialty: item.specialty,
        count: item._count.specialty
      }))
    },
    generatedAt: new Date().toISOString()
  });
} 