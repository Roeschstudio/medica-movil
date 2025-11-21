import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { ErrorLogger } from "@/lib/error-handling-utils";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get total users count
    const totalUsers = await prisma.user.count();

    // Get active chat rooms count
    const activeChats = await prisma.chatRoom.count({
      where: {
        isActive: true,
        status: "active",
      },
    });

    // Get active video sessions count
    const activeCalls = await prisma.videoSession.count({
      where: {
        status: "active",
      },
    });

    // Get total revenue from completed payments
    const revenueResult = await prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: "completed",
      },
    });

    const totalRevenue = revenueResult._sum.amount || 0;

    // Get pending payments count
    const pendingPayments = await prisma.paymentDistribution.count({
      where: {
        status: "pending",
      },
    });

    // Get online doctors count (simplified - in real app would use Redis/session store)
    const onlineDoctors = await prisma.doctor.count({
      where: {
        user: {
          // This is a simplified approach - in production you'd track online status
          updatedAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      },
    });

    // Get online patients count (simplified)
    const onlinePatients = await prisma.patient.count({
      where: {
        user: {
          updatedAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      },
    });

    // Additional stats for charts/trends
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = {
      newUsers: await prisma.user.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      }),

      completedAppointments: await prisma.appointment.count({
        where: {
          status: "completed",
          scheduledAt: {
            gte: today,
          },
        },
      }),

      totalMessages: await prisma.chatMessage.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      }),

      revenue: await prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          status: "completed",
          createdAt: {
            gte: today,
          },
        },
      }),
    };

    // Weekly stats for trends
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const weeklyStats = {
      newUsers: await prisma.user.count({
        where: {
          createdAt: {
            gte: weekAgo,
          },
        },
      }),

      completedAppointments: await prisma.appointment.count({
        where: {
          status: "completed",
          scheduledAt: {
            gte: weekAgo,
          },
        },
      }),

      revenue: await prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          status: "completed",
          createdAt: {
            gte: weekAgo,
          },
        },
      }),
    };

    // Top specialties by appointment count
    const topSpecialties = await prisma.appointment.groupBy({
      by: ["doctorId"],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 5,
    });

    // Get specialty details
    const specialtyDetails = await Promise.all(
      topSpecialties.map(async (item) => {
        const doctor = await prisma.doctor.findUnique({
          where: { id: item.doctorId },
          include: {
            specialty: true,
          },
        });

        return {
          specialty: doctor?.specialty?.name || "Unknown",
          appointmentCount: item._count.id,
        };
      })
    );

    const stats = {
      totalUsers,
      activeChats,
      activeCalls,
      totalRevenue,
      pendingPayments,
      onlineDoctors,
      onlinePatients,
      today: {
        ...todayStats,
        revenue: todayStats.revenue._sum.amount || 0,
      },
      weekly: {
        ...weeklyStats,
        revenue: weeklyStats.revenue._sum.amount || 0,
      },
      topSpecialties: specialtyDetails,
    };

    return NextResponse.json(stats);
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Admin stats retrieval",
      action: "GET /api/admin/stats",
      level: "error"
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Real-time stats update endpoint
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json();

    // Handle real-time stat updates
    switch (action) {
      case "user_connected":
        // In production, you'd update Redis or session store
        // For now, we'll just return success
        break;

      case "user_disconnected":
        // Handle user disconnection
        break;

      case "chat_started":
        // Update chat statistics
        break;

      case "video_started":
        // Update video call statistics
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Admin stats update",
      action: "POST /api/admin/stats",
      level: "error"
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
