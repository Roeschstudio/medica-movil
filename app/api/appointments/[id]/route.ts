import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorLogger } from "@/lib/error-logger";

// Validation schemas
const updateAppointmentSchema = z.object({
  status: z
    .enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
  notes: z.string().optional(),
  paymentId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  type: z.enum(["CONSULTATION", "FOLLOW_UP", "EMERGENCY"]).optional(),
});

const confirmAppointmentSchema = z.object({
  paymentIntentId: z.string(),
  paymentMethod: z.enum(["STRIPE", "PAYPAL"]),
});

// GET /api/appointments/[id] - Get specific appointment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointmentId = params.id;

    // Build where clause based on user role
    const whereClause: any = { id: appointmentId };

    if (session.user.role === "PATIENT") {
      whereClause.patientId = session.user.id;
    } else if (session.user.role === "DOCTOR") {
      // Find doctor profile to get doctor ID
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
    } else if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
    }

    const appointment = await prisma.appointment.findFirst({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentMethod: true,
            stripePaymentIntentId: true,
            paypalOrderId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        chatRoom: {
          select: {
            id: true,
            isActive: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                messages: true,
              },
            },
          },
        },
        videoSessions: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            duration: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        medicalFiles: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            uploadedBy: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
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

    return NextResponse.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error fetching appointment",
      action: "GET /api/appointments/[id]",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PATCH /api/appointments/[id] - Update specific appointment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointmentId = params.id;
    const body = await request.json();
    const validatedData = updateAppointmentSchema.parse(body);

    // Build where clause based on user role
    const whereClause: any = { id: appointmentId };

    if (session.user.role === "PATIENT") {
      whereClause.patientId = session.user.id;
      // Patients can only update notes and cancel
      if (
        validatedData.status &&
        !["CANCELLED"].includes(validatedData.status)
      ) {
        return NextResponse.json(
          { error: "Los pacientes solo pueden cancelar citas" },
          { status: 403 }
        );
      }
    } else if (session.user.role === "DOCTOR") {
      whereClause.doctorId = session.user.id;
      // Doctors can update status, notes, and reschedule
    } else if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
    }

    // Check if appointment exists
    const existingAppointment = await prisma.appointment.findFirst({
      where: whereClause,
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
      },
    });

    if (!existingAppointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Validate status transitions
    if (validatedData.status) {
      const validTransitions: Record<string, string[]> = {
        SCHEDULED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
        CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
        COMPLETED: [], // Cannot change from completed
        CANCELLED: [], // Cannot change from cancelled
        NO_SHOW: [], // Cannot change from no show
      };

      const currentStatus = existingAppointment.status;
      const newStatus = validatedData.status;

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return NextResponse.json(
          {
            error: `No se puede cambiar el estado de ${currentStatus} a ${newStatus}`,
          },
          { status: 400 }
        );
      }
    }

    // If rescheduling, check doctor availability
    if (validatedData.scheduledAt) {
      const newDate = new Date(validatedData.scheduledAt);
      const dayOfWeek = newDate.getDay();
      const timeString = newDate.toTimeString().slice(0, 5);

      // Check doctor availability
      const doctorAvailability = await prisma.availability.findFirst({
        where: {
          doctorId: existingAppointment.doctorId,
          dayOfWeek,
          startTime: { lte: timeString },
          endTime: { gt: timeString },
          isActive: true,
        },
      });

      if (!doctorAvailability) {
        return NextResponse.json(
          { error: "El doctor no tiene disponibilidad en el nuevo horario" },
          { status: 400 }
        );
      }

      // Check for conflicts
      const conflictingAppointment = await prisma.appointment.findFirst({
        where: {
          doctorId: existingAppointment.doctorId,
          scheduledAt: newDate,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          id: { not: appointmentId },
        },
      });

      if (conflictingAppointment) {
        return NextResponse.json(
          { error: "Ya existe una cita en el nuevo horario" },
          { status: 409 }
        );
      }
    }

    // Update appointment in transaction
    const result = await prisma.$transaction(async (tx) => {
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
            select: {
              id: true,
              name: true,
              email: true,
              specialty: true,
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
            },
          },
        },
      });

      // Update chat room status if appointment is cancelled or completed
      if (
        validatedData.status === "CANCELLED" ||
        validatedData.status === "COMPLETED"
      ) {
        await tx.chatRoom.updateMany({
          where: { appointmentId },
          data: {
            status: "CLOSED",
            updatedAt: new Date(),
          },
        });
      }

      // Handle payment refund if cancelled
      if (
        validatedData.status === "CANCELLED" &&
        existingAppointment.paymentId
      ) {
        await tx.payment.update({
          where: { id: existingAppointment.paymentId },
          data: {
            status: "REFUND_PENDING",
            updatedAt: new Date(),
          },
        });
      }

      // Log admin activity
      await tx.adminLog.create({
        data: {
          action: "APPOINTMENT_UPDATED",
          details: {
            appointmentId,
            patientId: existingAppointment.patientId,
            doctorId: existingAppointment.doctorId,
            changes: validatedData,
            previousStatus: existingAppointment.status,
            updatedBy: session.user.id,
          },
          userId: session.user.id,
        },
      });

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
      action: "PATCH /api/appointments/[id]",
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

// DELETE /api/appointments/[id] - Cancel specific appointment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointmentId = params.id;
    const body = await request.json();
    const { reason } = body;

    // Build where clause based on user role
    const whereClause: any = {
      id: appointmentId,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    };

    if (session.user.role === "PATIENT") {
      whereClause.patientId = session.user.id;
    } else if (session.user.role === "DOCTOR") {
      whereClause.doctorId = session.user.id;
    } else if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
    }

    // Check if appointment exists and can be cancelled
    const appointment = await prisma.appointment.findFirst({
      where: whereClause,
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
        payment: { select: { id: true, status: true, amount: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada o no se puede cancelar" },
        { status: 404 }
      );
    }

    // Cancel appointment in transaction
    const result = await prisma.$transaction(async (tx) => {
      const cancelledAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "CANCELLED",
          notes: reason ? `Cancelada: ${reason}` : "Cancelada por el usuario",
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
            select: {
              id: true,
              name: true,
              email: true,
              specialty: true,
            },
          },
        },
      });

      // Close related chat room
      await tx.chatRoom.updateMany({
        where: { appointmentId },
        data: {
          status: "CLOSED",
          updatedAt: new Date(),
        },
      });

      // Handle payment refund if needed
      if (appointment.payment && appointment.payment.status === "COMPLETED") {
        await tx.payment.update({
          where: { id: appointment.payment.id },
          data: {
            status: "REFUND_PENDING",
            updatedAt: new Date(),
          },
        });
      }

      // Log admin activity
      await tx.adminLog.create({
        data: {
          action: "APPOINTMENT_CANCELLED",
          details: {
            appointmentId,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            reason: reason || "Usuario canceló",
            cancelledBy: session.user.id,
            paymentRefundRequired: appointment.payment?.status === "COMPLETED",
          },
          userId: session.user.id,
        },
      });

      return cancelledAppointment;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "Cita cancelada correctamente",
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error cancelling appointment",
      action: "DELETE /api/appointments/[id]",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/appointments/[id] - Special operations (confirm with payment)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "PATIENT") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointmentId = params.id;
    const body = await request.json();
    const { action } = body;

    if (action === "confirm") {
      const validatedData = confirmAppointmentSchema.parse(body);

      // Check if appointment exists and belongs to patient
      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          patientId: session.user.id,
          status: "SCHEDULED",
        },
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            },
          },
        },
      });

      if (!appointment) {
        return NextResponse.json(
          { error: "Cita no encontrada o no se puede confirmar" },
          { status: 404 }
        );
      }

      // Create payment and confirm appointment in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create payment record
        const payment = await tx.payment.create({
          data: {
            appointmentId,
            patientId: session.user.id,
            amount: 500, // Base consultation fee - should come from doctor settings
            currency: "MXN",
            paymentMethod: validatedData.paymentMethod,
            status: "COMPLETED",
            stripePaymentIntentId:
              validatedData.paymentMethod === "STRIPE"
                ? validatedData.paymentIntentId
                : null,
            paypalOrderId:
              validatedData.paymentMethod === "PAYPAL"
                ? validatedData.paymentIntentId
                : null,
          },
        });

        // Update appointment status and link payment
        const confirmedAppointment = await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            status: "CONFIRMED",
            paymentId: payment.id,
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
              select: {
                id: true,
                name: true,
                email: true,
                specialty: true,
              },
            },
          },
        });

        // Activate chat room
        await tx.chatRoom.updateMany({
          where: { appointmentId },
          data: {
            status: "ACTIVE",
            updatedAt: new Date(),
          },
        });

        // Log admin activity
        await tx.adminLog.create({
          data: {
            action: "APPOINTMENT_CONFIRMED",
            details: {
              appointmentId,
              patientId: session.user.id,
              doctorId: appointment.doctorId,
              paymentId: payment.id,
              amount: payment.amount,
              paymentMethod: validatedData.paymentMethod,
            },
            userId: session.user.id,
          },
        });

        return { appointment: confirmedAppointment, payment };
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: "Cita confirmada y pago procesado correctamente",
      });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error processing appointment action",
      action: "POST /api/appointments/[id]",
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
