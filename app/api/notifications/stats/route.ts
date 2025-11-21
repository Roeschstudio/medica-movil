import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get notification statistics for the user
    const [
      totalNotifications,
      unreadNotifications,
      emailNotifications,
      smsNotifications,
      whatsappNotifications,
      todayNotifications,
      weekNotifications,
    ] = await Promise.all([
      prisma.notification.count({
        where: { userId },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      prisma.notification.count({
        where: { userId, type: "EMAIL" },
      }),
      prisma.notification.count({
        where: { userId, type: "SMS" },
      }),
      prisma.notification.count({
        where: { userId, type: "WHATSAPP" },
      }),
      prisma.notification.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.notification.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const stats = {
      total: totalNotifications,
      unread: unreadNotifications,
      read: totalNotifications - unreadNotifications,
      byType: {
        email: emailNotifications,
        sms: smsNotifications,
        whatsapp: whatsappNotifications,
      },
      recent: {
        today: todayNotifications,
        thisWeek: weekNotifications,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
