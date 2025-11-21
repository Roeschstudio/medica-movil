import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { ErrorLogger } from '@/lib/error-handling-utils';

const distributePaymentSchema = z.object({
  paymentId: z.string(),
  doctorAmount: z.number().min(0),
  platformAmount: z.number().min(0),
  taxAmount: z.number().min(0).optional().default(0),
  notes: z.string().optional()
});



export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { paymentId, doctorAmount, platformAmount, taxAmount, notes } = 
      distributePaymentSchema.parse(body);

    // Verify payment exists and is completed
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        status: 'COMPLETED'
      },
      include: {
        appointment: {
          include: {
            doctor: { include: { user: true } }
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found or not completed' }, { status: 404 });
    }

    // Check if distribution already exists
    const existingDistribution = await prisma.paymentDistribution.findFirst({
      where: { paymentId }
    });

    if (existingDistribution) {
      return NextResponse.json({ error: 'Payment already distributed' }, { status: 400 });
    }

    // Validate amounts
    const totalDistributed = doctorAmount + platformAmount + taxAmount;
    if (Math.abs(totalDistributed - payment.amount) > 0.01) {
      return NextResponse.json({ 
        error: 'Distribution amounts do not match payment total' 
      }, { status: 400 });
    }

    // Create payment distribution
    const distribution = await prisma.paymentDistribution.create({
      data: {
        paymentId,
        doctorId: payment.appointment.doctor.id,
        doctorAmount,
        platformAmount,
        taxAmount,
        distributedBy: session.user.id,
        notes,
        distributedAt: new Date()
      },
      include: {
        payment: {
          include: {
            appointment: {
              include: {
                patient: true,
                doctor: { include: { user: true } }
              }
            }
          }
        },
        doctor: { include: { user: true } },
        distributedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(distribution);
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Payment distribution",
      action: "POST /api/admin/payments/distribute",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    interface WhereClause {
      doctorId?: string;
      distributedAt?: {
        gte?: Date;
        lte?: Date;
      };
    }
    
    const whereClause: WhereClause = {};
    
    if (doctorId) {
      whereClause.doctorId = doctorId;
    }
    
    if (startDate || endDate) {
      whereClause.distributedAt = {};
      if (startDate) {
        whereClause.distributedAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.distributedAt.lte = new Date(endDate);
      }
    }

    // Get payment distributions
    const distributions = await prisma.paymentDistribution.findMany({
      where: whereClause,
      include: {
        payment: {
          include: {
            appointment: {
              include: {
                patient: true,
                doctor: { include: { user: true } }
              }
            }
          }
        },
        doctor: { include: { user: true } },
        distributedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { distributedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    // Get total count
    const totalCount = await prisma.paymentDistribution.count({
      where: whereClause
    });

    // Calculate summary statistics
    const summary = await prisma.paymentDistribution.aggregate({
      where: whereClause,
      _sum: {
        doctorAmount: true,
        platformAmount: true,
        taxAmount: true
      },
      _count: {
        id: true
      }
    });

    return NextResponse.json({
      distributions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        totalDistributions: summary._count.id,
        totalDoctorAmount: summary._sum.doctorAmount || 0,
        totalPlatformAmount: summary._sum.platformAmount || 0,
        totalTaxAmount: summary._sum.taxAmount || 0
      }
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Payment distributions fetch",
      action: "GET /api/admin/payments/distribute",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
