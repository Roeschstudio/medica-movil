import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (method && method !== 'all') {
      where.method = method;
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }
    
    if (search) {
      where.OR = [
        {
          stripePaymentIntentId: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          paypalOrderId: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          appointment: {
            doctor: {
              user: {
                name: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            }
          }
        },
        {
          appointment: {
            patient: {
              user: {
                name: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            }
          }
        }
      ];
    }
    
    // Build order by clause
    const orderBy: any = {};
    if (sortBy === 'amount') {
      orderBy.amount = sortOrder;
    } else if (sortBy === 'doctorName') {
      orderBy.appointment = {
        doctor: {
          user: {
            name: sortOrder
          }
        }
      };
    } else if (sortBy === 'patientName') {
      orderBy.appointment = {
        patient: {
          user: {
            name: sortOrder
          }
        }
      };
    } else {
      orderBy[sortBy] = sortOrder;
    }
    
    // Get payments with related data
    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          appointment: {
            include: {
              doctor: {
                include: {
                  user: true,
                  specialty: true
                }
              },
              patient: {
                include: {
                  user: true
                }
              }
            }
          },
          distributions: {
            include: {
              doctor: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      
      prisma.payment.count({ where })
    ]);
    
    // Format the response
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      paypalOrderId: payment.paypalOrderId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      appointment: {
        id: payment.appointment.id,
        scheduledAt: payment.appointment.scheduledAt,
        status: payment.appointment.status,
        doctor: {
          id: payment.appointment.doctor.id,
          name: payment.appointment.doctor.user.name,
          email: payment.appointment.doctor.user.email,
          specialty: payment.appointment.doctor.specialty?.name || 'General',
          consultationFee: payment.appointment.doctor.consultationFee
        },
        patient: {
          id: payment.appointment.patient.id,
          name: payment.appointment.patient.user.name,
          email: payment.appointment.patient.user.email
        }
      },
      distributions: payment.distributions.map(dist => ({
        id: dist.id,
        amount: dist.amount,
        percentage: dist.percentage,
        status: dist.status,
        doctor: {
          id: dist.doctor.id,
          name: dist.doctor.user.name
        },
        createdAt: dist.createdAt
      })),
      totalDistributed: payment.distributions.reduce((sum, dist) => sum + dist.amount, 0),
      platformFee: payment.amount - payment.distributions.reduce((sum, dist) => sum + dist.amount, 0)
    }));
    
    // Get summary statistics
    const [summary, revenueStats] = await Promise.all([
      prisma.payment.groupBy({
        by: ['status'],
        _count: {
          id: true
        },
        _sum: {
          amount: true
        }
      }),
      
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      })
    ]);
    
    // Calculate platform revenue
    const platformRevenue = await prisma.payment.aggregate({
      where: {
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });
    
    const distributedAmount = await prisma.paymentDistribution.aggregate({
      where: {
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });
    
    const totalPlatformFee = (platformRevenue._sum.amount || 0) - (distributedAmount._sum.amount || 0);
    
    return NextResponse.json({
      payments: formattedPayments,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        byStatus: summary.reduce((acc, stat) => {
          acc[stat.status] = {
            count: stat._count.id,
            amount: stat._sum.amount || 0
          };
          return acc;
        }, {} as Record<string, { count: number; amount: number }>),
        recent: {
          count: revenueStats._count.id,
          amount: revenueStats._sum.amount || 0
        },
        platformRevenue: {
          total: totalPlatformFee,
          percentage: platformRevenue._sum.amount ? 
            (totalPlatformFee / platformRevenue._sum.amount) * 100 : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Admin payments list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Process payment actions (refund, dispute, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { paymentId, action, amount, reason } = await request.json();
    
    if (!paymentId || !action) {
      return NextResponse.json(
        { error: 'Payment ID and action are required' },
        { status: 400 }
      );
    }
    
    // Verify payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        appointment: {
          include: {
            doctor: { include: { user: true } },
            patient: { include: { user: true } }
          }
        },
        distributions: true
      }
    });
    
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    let updateData: any = {};
    let logMessage = '';
    
    switch (action) {
      case 'refund':
        if (payment.status !== 'COMPLETED') {
          return NextResponse.json(
            { error: 'Can only refund completed payments' },
            { status: 400 }
          );
        }
        
        const refundAmount = amount || payment.amount;
        
        // Process refund based on payment method
        if (payment.method === 'STRIPE' && payment.stripePaymentIntentId) {
          // Stripe refund logic would go here
          // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          // await stripe.refunds.create({
          //   payment_intent: payment.stripePaymentIntentId,
          //   amount: refundAmount * 100 // Stripe uses cents
          // });
        } else if (payment.method === 'PAYPAL' && payment.paypalOrderId) {
          // PayPal refund logic would go here
        }
        
        updateData = {
          status: 'REFUNDED',
          refundAmount,
          refundReason: reason
        };
        logMessage = `Payment refunded: $${refundAmount}. Reason: ${reason || 'Admin action'}`;
        break;
        
      case 'dispute':
        updateData = {
          status: 'DISPUTED',
          disputeReason: reason
        };
        logMessage = `Payment disputed. Reason: ${reason || 'Admin action'}`;
        break;
        
      case 'resolve':
        if (payment.status !== 'DISPUTED') {
          return NextResponse.json(
            { error: 'Can only resolve disputed payments' },
            { status: 400 }
          );
        }
        
        updateData = {
          status: 'COMPLETED',
          disputeReason: null
        };
        logMessage = 'Payment dispute resolved';
        break;
        
      case 'cancel':
        if (payment.status === 'COMPLETED') {
          return NextResponse.json(
            { error: 'Cannot cancel completed payments' },
            { status: 400 }
          );
        }
        
        updateData = {
          status: 'CANCELLED',
          cancelReason: reason
        };
        logMessage = `Payment cancelled. Reason: ${reason || 'Admin action'}`;
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    // Update payment in transaction
    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: updateData
      });
      
      // If refunding, update distributions
      if (action === 'refund' && payment.distributions.length > 0) {
        await tx.paymentDistribution.updateMany({
          where: {
            paymentId: paymentId,
            status: 'COMPLETED'
          },
          data: {
            status: 'REFUNDED'
          }
        });
      }
      
      return updated;
    });
    
    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: session.user.id,
        action: `payment_${action}`,
        targetType: 'PAYMENT',
        targetId: paymentId,
        details: {
          paymentId,
          action,
          amount,
          reason,
          originalAmount: payment.amount,
          paymentMethod: payment.method,
          doctorId: payment.appointment.doctor.id,
          patientId: payment.appointment.patient.id
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      payment: updatedPayment,
      message: `Payment ${action} completed successfully`
    });
    
  } catch (error) {
    console.error('Admin payment action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get payment analytics
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { period = '30d', groupBy = 'day' } = await request.json();
    
    // Calculate date range
    let dateFrom: Date;
    const dateTo = new Date();
    
    switch (period) {
      case '7d':
        dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        dateFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Get revenue trends
    const revenueTrends = await prisma.payment.groupBy({
      by: ['createdAt'],
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: dateFrom,
          lte: dateTo
        }
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });
    
    // Get payment method distribution
    const methodDistribution = await prisma.payment.groupBy({
      by: ['method'],
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: dateFrom,
          lte: dateTo
        }
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });
    
    // Get top earning doctors
    const topDoctors = await prisma.paymentDistribution.groupBy({
      by: ['doctorId'],
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: dateFrom,
          lte: dateTo
        }
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      },
      take: 10
    });
    
    // Get doctor details for top earners
    const doctorDetails = await prisma.doctor.findMany({
      where: {
        id: {
          in: topDoctors.map(d => d.doctorId)
        }
      },
      include: {
        user: true,
        specialty: true
      }
    });
    
    const topDoctorsWithDetails = topDoctors.map(doctor => {
      const details = doctorDetails.find(d => d.id === doctor.doctorId);
      return {
        doctorId: doctor.doctorId,
        name: details?.user.name || 'Unknown',
        specialty: details?.specialty?.name || 'General',
        totalEarnings: doctor._sum.amount || 0,
        totalPayments: doctor._count.id
      };
    });
    
    return NextResponse.json({
      analytics: {
        period,
        dateRange: {
          from: dateFrom,
          to: dateTo
        },
        revenueTrends: revenueTrends.map(trend => ({
          date: trend.createdAt,
          revenue: trend._sum.amount || 0,
          count: trend._count.id
        })),
        methodDistribution: methodDistribution.map(method => ({
          method: method.method,
          revenue: method._sum.amount || 0,
          count: method._count.id
        })),
        topDoctors: topDoctorsWithDetails
      }
    });
    
  } catch (error) {
    console.error('Admin payment analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
