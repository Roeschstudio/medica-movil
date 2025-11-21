import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createNotificationSchema = z.object({
  userId: z.string().cuid("Invalid user ID format"),
  type: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(1000, "Message too long"),
});

const bulkCreateNotificationSchema = z.object({
  userIds: z
    .array(z.string().cuid("Invalid user ID format"))
    .min(1, "At least one user ID required"),
  type: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(1000, "Message too long"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin users can create notifications for other users
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const isBulk = searchParams.get("bulk") === "true";

    if (isBulk) {
      const validationResult = bulkCreateNotificationSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid request data",
            details: validationResult.error.errors,
          },
          { status: 400 }
        );
      }

      const { userIds, type, title, message } = validationResult.data;

      // Verify all users exist
      const existingUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
      });

      if (existingUsers.length !== userIds.length) {
        return NextResponse.json(
          { error: "One or more users not found" },
          { status: 404 }
        );
      }

      // Create notifications for all users
      const notifications = await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type,
          title,
          message,
          sentAt: new Date(),
        })),
      });

      return NextResponse.json({
        message: `${notifications.count} notifications created successfully`,
        count: notifications.count,
      });
    } else {
      const validationResult = createNotificationSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid request data",
            details: validationResult.error.errors,
          },
          { status: 400 }
        );
      }

      const { userId, type, title, message } = validationResult.data;

      // Verify user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          sentAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json(notification);
    }
  } catch (error) {
    console.error("Error creating notification:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const type = searchParams.get("type") as
      | "EMAIL"
      | "SMS"
      | "WHATSAPP"
      | null;

    const skip = (page - 1) * limit;

    const where = {
      userId: session.user.id,
      ...(unreadOnly && { isRead: false }),
      ...(type && { type }),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
