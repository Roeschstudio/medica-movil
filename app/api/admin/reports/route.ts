import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/db';
import { ErrorLogger } from '@/lib/error-handling-utils';

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
    ErrorLogger.log({
      error: error,
      context: "Admin report generation",
      action: "GET /api/admin/reports",
      level: "error",
      userId: session?.user?.id
    });
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

  interface UserWithProfile {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    createdAt: Date;
    doctorProfile?: {
      specialty: string;
      isVerified: boolean;
      city: string;
      state: string;
      priceInPerson?: number;
      priceVirtual?: number;
      priceHomeVisit?: number;
    };
  }

  const report = users.map((user: UserWithProfile) => ({
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
      doctor: {
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

  interface AppointmentWithRelations {
    id: string;
    scheduledAt: Date;
    status: string;
    type: string;
    notes?: string;
    createdAt: Date;
    patient: {
      name: string;
      email: string;
    };
    doctor: {
      specialty: string;
      user: {
        name: string;
      };
    };
  }

  const report = appointments.map((appointment: AppointmentWithRelations) => ({
    id: appointment.id,
    scheduledAt: appointment.scheduledAt.toISOString(),
    status: appointment.status,
    consultationType: appointment.type,
    patientName: appointment.patient.name,
    patientEmail: appointment.patient.email,
    doctorName: appointment.doctor.user.name,
    doctorSpecialty: appointment.doctor.specialty,
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
      doctor: {
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

  interface CompletedAppointmentWithRelations {
    id: string;
    scheduledAt: Date;
    type: string;
    createdAt: Date;
    patient: {
      name: string;
    };
    doctor: {
      priceInPerson?: number;
      priceVirtual?: number;
      priceHomeVisit?: number;
      user: {
        name: string;
      };
    };
  }

  const report = completedAppointments.map((appointment: CompletedAppointmentWithRelations) => {
    let estimatedRevenue = 800; // Precio base por defecto
    
    if (appointment.type === 'IN_PERSON' && appointment.doctor.priceInPerson) {
      estimatedRevenue = appointment.doctor.priceInPerson;
    } else if (appointment.type === 'VIRTUAL' && appointment.doctor.priceVirtual) {
      estimatedRevenue = appointment.doctor.priceVirtual;
    } else if (appointment.type === 'HOME_VISIT' && appointment.doctor.priceHomeVisit) {
      estimatedRevenue = appointment.doctor.priceHomeVisit;
    }

    return {
      appointmentId: appointment.id,
      date: appointment.scheduledAt.toISOString(),
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.user.name,
      consultationType: appointment.type,
      estimatedRevenue: estimatedRevenue,
      platformFee: Math.round(estimatedRevenue * 0.1), // 10% comisión
      createdAt: appointment.createdAt.toISOString()
    };
  });

  interface ReportItem {
    estimatedRevenue: number;
    platformFee: number;
  }

  const totalRevenue = report.reduce((sum: number, item: ReportItem) => sum + item.estimatedRevenue, 0);
  const totalFees = report.reduce((sum: number, item: ReportItem) => sum + item.platformFee, 0);

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

  interface SpecialtyGroup {
    specialty: string;
    _count: {
      specialty: number;
    };
  }

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
      topSpecialties: topSpecialties.map((item: SpecialtyGroup) => ({
        specialty: item.specialty,
        count: item._count.specialty
      }))
    },
    generatedAt: new Date().toISOString()
  });
}
