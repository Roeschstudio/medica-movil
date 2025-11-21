import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from "@/lib/db";
import { z } from 'zod';
import { ErrorLogger } from '@/lib/error-handling-utils';

const earningsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)).optional()
});

// GET /api/doctor/earnings - Get doctor earnings and payment history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo para doctores.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { startDate, endDate, status, page = 1, limit = 10 } = earningsQuerySchema.parse(queryParams);

    // Get doctor
    const doctor = await prisma.doctor.findUnique({
      where: {
        userId: session.user.id
      }
    });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Perfil de doctor no encontrado' },
        { status: 404 }
      );
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Build where clause
    const whereClause: {
      appointment: { doctorId: string };
      createdAt?: { gte?: Date; lte?: Date };
      status?: string;
    } = {
      appointment: {
        doctorId: doctor.id
      }
    };

    if (Object.keys(dateFilter).length > 0) {
      whereClause.createdAt = dateFilter;
    }

    if (status) {
      whereClause.status = status;
    }

    // Get payments with pagination
    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        include: {
          appointment: {
            include: {
              patient: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              doctor: {
                select: {
                  id: true,
                  consultationFee: true,
                  user: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          },
          paymentDistributions: {
            where: {
              doctorId: doctor.id
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.payment.count({
        where: whereClause
      })
    ]);

    // Calculate earnings summary
    const earningsSummary = await prisma.payment.aggregate({
      where: {
        appointment: {
          doctorId: doctor.id
        },
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Get payment distributions summary
    const distributionsSummary = await prisma.paymentDistribution.aggregate({
      where: {
        doctorId: doctor.id,
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Get monthly earnings for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyEarnings = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', p."createdAt") as month,
        SUM(pd.amount) as earnings,
        COUNT(pd.id) as transactions
      FROM "PaymentDistribution" pd
      JOIN "Payment" p ON pd."paymentId" = p.id
      WHERE pd."doctorId" = ${doctor.id}
        AND pd.status = 'COMPLETED'
        AND p."createdAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', p."createdAt")
      ORDER BY month DESC
    `;

    // Get pending withdrawals
    const pendingWithdrawals = await prisma.paymentDistribution.findMany({
      where: {
        doctorId: doctor.id,
        status: 'PENDING'
      },
      include: {
        payment: {
          include: {
            appointment: {
              select: {
                id: true,
                scheduledAt: true,
                patient: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    // Calculate total pending amount
    const pendingAmount = await prisma.paymentDistribution.aggregate({
      where: {
        doctorId: doctor.id,
        status: 'PENDING'
      },
      _sum: {
        amount: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        summary: {
          totalEarnings: earningsSummary._sum.amount || 0,
          totalTransactions: earningsSummary._count || 0,
          distributedEarnings: distributionsSummary._sum.amount || 0,
          distributedTransactions: distributionsSummary._count || 0,
          pendingAmount: pendingAmount._sum.amount || 0
        },
        monthlyEarnings,
        pendingWithdrawals
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Parámetros inválidos',
          details: error.errors
        },
        { status: 400 }
      );
    }

    ErrorLogger.log({
      error,
      context: 'Error fetching doctor earnings',
      action: 'GET /api/doctor/earnings',
      level: 'error',
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/doctor/earnings - Request withdrawal
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo para doctores.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { amount, paymentMethod, accountDetails } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Monto inválido' },
        { status: 400 }
      );
    }

    if (!paymentMethod || !accountDetails) {
      return NextResponse.json(
        { error: 'Método de pago y detalles de cuenta son requeridos' },
        { status: 400 }
      );
    }

    // Get doctor
    const doctor = await prisma.doctor.findUnique({
      where: {
        userId: session.user.id
      }
    });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Perfil de doctor no encontrado' },
        { status: 404 }
      );
    }

    // Check available balance
    const availableBalance = await prisma.paymentDistribution.aggregate({
      where: {
        doctorId: doctor.id,
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });

    const withdrawnAmount = await prisma.withdrawal.aggregate({
      where: {
        doctorId: doctor.id,
        status: { in: ['PENDING', 'COMPLETED'] }
      },
      _sum: {
        amount: true
      }
    });

    const available = (availableBalance._sum.amount || 0) - (withdrawnAmount._sum.amount || 0);

    if (amount > available) {
      return NextResponse.json(
        { error: `Saldo insuficiente. Disponible: $${available.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Create withdrawal request
    const withdrawal = await prisma.withdrawal.create({
      data: {
        doctorId: doctor.id,
        amount,
        paymentMethod,
        accountDetails,
        status: 'PENDING',
        requestedAt: new Date()
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Log the withdrawal request
    await prisma.adminLog.create({
      data: {
        action: 'WITHDRAWAL_REQUESTED',
        details: {
          withdrawalId: withdrawal.id,
          doctorId: doctor.id,
          amount,
          paymentMethod,
          timestamp: new Date().toISOString()
        },
        performedBy: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Solicitud de retiro creada correctamente',
      withdrawal
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: 'Error creating withdrawal request',
      action: 'POST /api/doctor/earnings',
      level: 'error',
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/doctor/earnings/withdrawals - Get withdrawal history
export async function PATCH(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo para doctores.' },
        { status: 403 }
      );
    }

    // Get doctor
    const doctor = await prisma.doctor.findUnique({
      where: {
        userId: session.user.id
      }
    });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Perfil de doctor no encontrado' },
        { status: 404 }
      );
    }

    // Get withdrawal history
    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        doctorId: doctor.id
      },
      orderBy: {
        requestedAt: 'desc'
      },
      take: 50
    });

    return NextResponse.json({
      success: true,
      withdrawals
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: 'Error fetching withdrawal history',
      action: 'PATCH /api/doctor/earnings',
      level: 'error',
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
