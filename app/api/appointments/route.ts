import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/unified-auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorLogger } from "@/lib/error-logger";

// Validation schemas
const createAppointmentSchema = z.object({
  doctorId: z.string().cuid(),
  scheduledAt: z.string().datetime(),
  type: z.enum(["IN_PERSON", "VIRTUAL", "HOME_VISIT"]),
  notes: z.string().optional(),
});

const updateAppointmentSchema = z.object({
  status: z
    .enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
  notes: z.string().optional(),
  paymentId: z.string().optional(),
});

const appointmentFiltersSchema = z.object({
  status: z.string().optional(),
  doctorId: z.string().cuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

// GET /api/appointments - Get user's appointments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filters = appointmentFiltersSchema.parse({
      status: searchParams.get("status"),
      doctorId: searchParams.get("doctorId"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    // Build where clause based on user role
    const whereClause: any = {};

    if (session.user.role === "PATIENT") {
      whereClause.patientId = session.user.id;
    } else if (session.user.role === "DOCTOR") {
      // Find doctor profile
      const doctorProfile = await prisma.doctor.findUnique({
        where: { userId: session.user.id },
      });
      if (!doctorProfile) {
        return NextResponse.json(
          { error: "Perfil de doctor no encontrado" },
          { status: 404 }
        );
      }
      whereClause.doctorId = doctorProfile.id;
    } else {
      return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
    }

    // Add filters
    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.doctorId && session.user.role === "PATIENT") {
      whereClause.doctorId = filters.doctorId;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.scheduledAt = {};
      if (filters.startDate) {
        whereClause.scheduledAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        whereClause.scheduledAt.lte = new Date(filters.endDate);
      }
    }

    // Get total count for pagination
    const total = await prisma.appointment.count({ where: whereClause });
    const pages = Math.ceil(total / filters.limit);
    const skip = (filters.page - 1) * filters.limit;

    // Get appointments with related data
    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            createdAt: true,
          },
        },
        chatRoom: {
          select: {
            id: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        scheduledAt: "desc",
      },
      skip,
      take: filters.limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          pages,
        },
      },
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error fetching appointments",
      action: "GET /api/appointments",
      level: "error",
      userId: session?.user?.id
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/appointments - Create new appointment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "PATIENT") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createAppointmentSchema.parse(body);

    // Verify doctor exists and is active
    const doctor = await prisma.doctor.findFirst({
      where: {
        id: validatedData.doctorId,
        user: {
          isActive: true,
        },
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

    if (!doctor) {
      return NextResponse.json(
        { error: "Doctor no encontrado o no disponible" },
        { status: 404 }
      );
    }

    // Get appointment date and basic validation
    const appointmentDate = new Date(validatedData.scheduledAt);

    // Check if appointment is in the future
    if (appointmentDate <= new Date()) {
      return NextResponse.json(
        { error: "La cita debe ser programada para una fecha futura" },
        { status: 400 }
      );
    }

    // Check for conflicting appointments
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId: validatedData.doctorId,
        scheduledAt: appointmentDate,
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
      },
    });

    if (conflictingAppointment) {
      return NextResponse.json(
        { error: "Ya existe una cita programada en ese horario" },
        { status: 409 }
      );
    }

    // Get patient phone and email for appointment
    const patient = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, email: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Determine price based on consultation type
    let price = 0;
    switch (validatedData.type) {
      case "IN_PERSON":
        price = doctor.priceInPerson || 80000; // Default $800 MXN
        break;
      case "VIRTUAL":
        price = doctor.priceVirtual || 60000; // Default $600 MXN
        break;
      case "HOME_VISIT":
        price = doctor.priceHomeVisit || 120000; // Default $1200 MXN
        break;
    }

    // Determine duration based on consultation type
    let duration = 30; // Default 30 minutes
    switch (validatedData.type) {
      case "IN_PERSON":
        duration = doctor.durationInPerson || 30;
        break;
      case "VIRTUAL":
        duration = doctor.durationVirtual || 30;
        break;
      case "HOME_VISIT":
        duration = doctor.durationHomeVisit || 60;
        break;
    }

    // Create appointment and chat room in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create appointment
      const appointment = await tx.appointment.create({
        data: {
          patientId: session.user.id,
          doctorId: validatedData.doctorId,
          type: validatedData.type,
          scheduledAt: appointmentDate,
          duration: duration,
          status: "PENDING",
          price: price,
          notes: validatedData.notes,
          patientPhone: patient.phone || "",
          patientEmail: patient.email,
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          doctor: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Create chat room for the appointment
      const chatRoom = await tx.chatRoom.create({
        data: {
          appointmentId: appointment.id,
          patientId: session.user.id,
          doctorId: validatedData.doctorId,
          isActive: false, // Will be activated when appointment is confirmed
        },
      });

      return { appointment, chatRoom };
    });

    return NextResponse.json(
      {
        success: true,
        data: result.appointment,
        message: "Cita creada correctamente",
      },
      { status: 201 }
    );
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error creating appointment",
      action: "POST /api/appointments",
      level: "error",
      userId: session?.user?.id
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PATCH /api/appointments - Update appointment status
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { appointmentId, ...updateData } = body;

    if (!appointmentId) {
      return NextResponse.json(
        { error: "ID de cita requerido" },
        { status: 400 }
      );
    }

    // Validate update data
    const validatedData = updateAppointmentSchema.parse(updateData);

    // Get appointment to check permissions
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        status: true,
        chatRoom: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Check permissions
    let canUpdate = false;
    if (session.user.role === "DOCTOR") {
      const doctorProfile = await prisma.doctor.findUnique({
        where: { userId: session.user.id },
      });
      canUpdate = doctorProfile?.id === appointment.doctorId;
    } else if (session.user.role === "PATIENT") {
      canUpdate = appointment.patientId === session.user.id;
    } else if (session.user.role === "ADMIN") {
      canUpdate = true;
    }

    if (!canUpdate) {
      return NextResponse.json(
        { error: "No tienes permisos para actualizar esta cita" },
        { status: 403 }
      );
    }

    // Update appointment and handle chat room activation
    const result = await prisma.$transaction(async (tx) => {
      // Update appointment
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          ...validatedData,
          updatedAt: new Date(),
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          doctor: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          chatRoom: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      });

      // If appointment is being confirmed, activate chat room
      if (validatedData.status === "CONFIRMED" && appointment.chatRoom) {
        await tx.chatRoom.update({
          where: { id: appointment.chatRoom.id },
          data: {
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }

      // If appointment is being cancelled or completed, deactivate chat room
      if (
        (validatedData.status === "CANCELLED" ||
          validatedData.status === "COMPLETED") &&
        appointment.chatRoom?.isActive
      ) {
        await tx.chatRoom.update({
          where: { id: appointment.chatRoom.id },
          data: {
            isActive: validatedData.status === "COMPLETED", // Keep active for completed appointments
            endedAt:
              validatedData.status === "CANCELLED" ? new Date() : undefined,
            updatedAt: new Date(),
          },
        });
      }

      return updatedAppointment;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "Cita actualizada correctamente",
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error updating appointment",
      action: "PATCH /api/appointments",
      level: "error",
      userId: session?.user?.id
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
