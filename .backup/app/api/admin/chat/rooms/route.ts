import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "lastActivity";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          appointment: {
            doctor: {
              user: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
        },
        {
          appointment: {
            patient: {
              user: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ];
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy === "lastActivity") {
      orderBy.lastActivity = sortOrder;
    } else if (sortBy === "createdAt") {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === "unreadCount") {
      orderBy.unreadCount = sortOrder;
    }

    // Get chat rooms with related data
    const [rooms, totalCount] = await Promise.all([
      prisma.chatRoom.findMany({
        where,
        include: {
          appointment: {
            include: {
              doctor: {
                include: {
                  user: true,
                  specialty: true,
                },
              },
              patient: {
                include: {
                  user: true,
                },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              sender: true,
            },
          },
          _count: {
            select: {
              messages: {
                where: {
                  isRead: false,
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),

      prisma.chatRoom.count({ where }),
    ]);

    // Format the response
    const formattedRooms = rooms.map((room) => ({
      id: room.id,
      status: room.status,
      type: room.type,
      isActive: room.isActive,
      lastActivity: room.lastActivity,
      unreadCount: room._count.messages,
      createdAt: room.createdAt,
      appointment: {
        id: room.appointment.id,
        scheduledAt: room.appointment.scheduledAt,
        status: room.appointment.status,
        doctor: {
          id: room.appointment.doctor.id,
          name: room.appointment.doctor.user.name,
          email: room.appointment.doctor.user.email,
          image: room.appointment.doctor.user.image,
          specialty: room.appointment.doctor.specialty?.name || "General",
          cedulaProfesional: room.appointment.doctor.cedulaProfesional,
          numeroIMSS: room.appointment.doctor.numeroIMSS,
        },
        patient: {
          id: room.appointment.patient.id,
          name: room.appointment.patient.user.name,
          email: room.appointment.patient.user.email,
          image: room.appointment.patient.user.image,
          dateOfBirth: room.appointment.patient.dateOfBirth,
          phone: room.appointment.patient.phone,
        },
      },
      lastMessage: room.messages[0]
        ? {
            id: room.messages[0].id,
            content: room.messages[0].content,
            type: room.messages[0].type,
            createdAt: room.messages[0].createdAt,
            sender: {
              id: room.messages[0].sender.id,
              name: room.messages[0].sender.name,
              role: room.messages[0].sender.role,
            },
          }
        : null,
    }));

    // Get summary statistics
    const summary = {
      total: totalCount,
      active: await prisma.chatRoom.count({
        where: { status: "active" },
      }),
      pending: await prisma.chatRoom.count({
        where: { status: "pending" },
      }),
      ended: await prisma.chatRoom.count({
        where: { status: "ended" },
      }),
    };

    return NextResponse.json({
      rooms: formattedRooms,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      summary,
    });
  } catch (error) {
    console.error("Admin chat rooms error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Update chat room status (admin action)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId, action, reason } = await request.json();

    if (!roomId || !action) {
      return NextResponse.json(
        { error: "Room ID and action are required" },
        { status: 400 }
      );
    }

    // Verify room exists
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        appointment: {
          include: {
            doctor: { include: { user: true } },
            patient: { include: { user: true } },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "Chat room not found" },
        { status: 404 }
      );
    }

    let updateData: any = {};
    let logMessage = "";

    switch (action) {
      case "suspend":
        updateData = {
          isActive: false,
          status: "ended",
        };
        logMessage = `Chat room suspended by admin. Reason: ${
          reason || "No reason provided"
        }`;
        break;

      case "reactivate":
        updateData = {
          isActive: true,
          status: "active",
        };
        logMessage = "Chat room reactivated by admin";
        break;

      case "end":
        updateData = {
          isActive: false,
          status: "ended",
        };
        logMessage = `Chat room ended by admin. Reason: ${
          reason || "Administrative action"
        }`;
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Update room in transaction
    const updatedRoom = await prisma.$transaction(async (tx) => {
      // Update the room
      const updated = await tx.chatRoom.update({
        where: { id: roomId },
        data: updateData,
      });

      // Add admin action message
      await tx.chatMessage.create({
        data: {
          roomId: roomId,
          senderId: session.user.id,
          content: logMessage,
          type: "TEXT",
          isRead: false,
          isAdminMessage: true,
        },
      });

      return updated;
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: session.user.id,
        action: `chat_room_${action}`,
        targetType: "CHAT_ROOM",
        targetId: roomId,
        details: {
          roomId,
          action,
          reason,
          doctorId: room.appointment.doctor.id,
          patientId: room.appointment.patient.id,
          appointmentId: room.appointment.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      room: updatedRoom,
      message: `Chat room ${action} successfully`,
    });
  } catch (error) {
    console.error("Admin chat room update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get detailed chat room information
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    // Get detailed room information
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        appointment: {
          include: {
            doctor: {
              include: {
                user: true,
                specialty: true,
              },
            },
            patient: {
              include: {
                user: true,
              },
            },
          },
        },
        messages: {
          include: {
            sender: true,
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 50, // Last 50 messages for admin review
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "Chat room not found" },
        { status: 404 }
      );
    }

    // Get message statistics
    const messageStats = await prisma.chatMessage.groupBy({
      by: ["type"],
      where: {
        roomId: roomId,
      },
      _count: {
        id: true,
      },
    });

    // Get admin logs for this room
    const adminLogs = await prisma.adminLog.findMany({
      where: {
        targetType: "CHAT_ROOM",
        targetId: roomId,
      },
      include: {
        admin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json({
      room: {
        ...room,
        messageStats: messageStats.reduce((acc, stat) => {
          acc[stat.type] = stat._count.id;
          return acc;
        }, {} as Record<string, number>),
        adminLogs: adminLogs.map((log) => ({
          id: log.id,
          action: log.action,
          createdAt: log.createdAt,
          admin: {
            id: log.admin.id,
            name: log.admin.name,
            email: log.admin.email,
          },
          details: log.details,
        })),
      },
    });
  } catch (error) {
    console.error("Admin chat room details error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
