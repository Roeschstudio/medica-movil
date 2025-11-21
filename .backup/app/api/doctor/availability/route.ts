import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const availabilitySchema = z.object({
  availability: z.array(
    z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
      isActive: z.boolean()
    })
  )
});

const updateAvailabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
  isActive: z.boolean()
});

// GET /api/doctor/availability - Get doctor availability
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

    // Get availability
    const availability = await prisma.doctorAvailability.findMany({
      where: {
        doctorId: doctor.id
      },
      orderBy: {
        dayOfWeek: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      availability
    });
  } catch (error) {
    console.error('Error fetching doctor availability:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/doctor/availability - Set doctor availability
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
    const validatedData = availabilitySchema.parse(body);

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

    // Validate time ranges
    for (const slot of validatedData.availability) {
      if (slot.isActive) {
        const startTime = new Date(`2000-01-01T${slot.startTime}:00`);
        const endTime = new Date(`2000-01-01T${slot.endTime}:00`);
        
        if (startTime >= endTime) {
          return NextResponse.json(
            { error: `Hora de inicio debe ser menor que hora de fin para el día ${slot.dayOfWeek}` },
            { status: 400 }
          );
        }
      }
    }

    // Use transaction to update availability
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing availability
      await tx.doctorAvailability.deleteMany({
        where: {
          doctorId: doctor.id
        }
      });

      // Create new availability slots
      const newAvailability = await tx.doctorAvailability.createMany({
        data: validatedData.availability.map(slot => ({
          doctorId: doctor.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive
        }))
      });

      // Get the created availability
      const availability = await tx.doctorAvailability.findMany({
        where: {
          doctorId: doctor.id
        },
        orderBy: {
          dayOfWeek: 'asc'
        }
      });

      return availability;
    });

    // Log the availability update
    await prisma.adminLog.create({
      data: {
        action: 'DOCTOR_AVAILABILITY_UPDATE',
        details: {
          doctorId: doctor.id,
          availabilitySlots: validatedData.availability.length,
          activeSlots: validatedData.availability.filter(slot => slot.isActive).length,
          timestamp: new Date().toISOString()
        },
        performedBy: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Disponibilidad actualizada correctamente',
      availability: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos',
          details: error.errors
        },
        { status: 400 }
      );
    }

    console.error('Error updating doctor availability:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PATCH /api/doctor/availability - Update specific availability slot
export async function PATCH(request: NextRequest) {
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
    const { id, ...updateData } = body;
    const validatedData = updateAvailabilitySchema.parse(updateData);

    if (!id) {
      return NextResponse.json(
        { error: 'ID de disponibilidad requerido' },
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

    // Validate time range
    if (validatedData.isActive) {
      const startTime = new Date(`2000-01-01T${validatedData.startTime}:00`);
      const endTime = new Date(`2000-01-01T${validatedData.endTime}:00`);
      
      if (startTime >= endTime) {
        return NextResponse.json(
          { error: 'Hora de inicio debe ser menor que hora de fin' },
          { status: 400 }
        );
      }
    }

    // Check if availability slot belongs to doctor
    const existingSlot = await prisma.doctorAvailability.findFirst({
      where: {
        id,
        doctorId: doctor.id
      }
    });

    if (!existingSlot) {
      return NextResponse.json(
        { error: 'Slot de disponibilidad no encontrado' },
        { status: 404 }
      );
    }

    // Update availability slot
    const updatedSlot = await prisma.doctorAvailability.update({
      where: {
        id
      },
      data: {
        ...validatedData,
        updatedAt: new Date()
      }
    });

    // Log the availability update
    await prisma.adminLog.create({
      data: {
        action: 'DOCTOR_AVAILABILITY_SLOT_UPDATE',
        details: {
          doctorId: doctor.id,
          slotId: id,
          dayOfWeek: validatedData.dayOfWeek,
          isActive: validatedData.isActive,
          timestamp: new Date().toISOString()
        },
        performedBy: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Slot de disponibilidad actualizado correctamente',
      availability: updatedSlot
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos',
          details: error.errors
        },
        { status: 400 }
      );
    }

    console.error('Error updating availability slot:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/doctor/availability - Delete availability slot
export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de disponibilidad requerido' },
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

    // Check if availability slot belongs to doctor
    const existingSlot = await prisma.doctorAvailability.findFirst({
      where: {
        id,
        doctorId: doctor.id
      }
    });

    if (!existingSlot) {
      return NextResponse.json(
        { error: 'Slot de disponibilidad no encontrado' },
        { status: 404 }
      );
    }

    // Delete availability slot
    await prisma.doctorAvailability.delete({
      where: {
        id
      }
    });

    // Log the availability deletion
    await prisma.adminLog.create({
      data: {
        action: 'DOCTOR_AVAILABILITY_SLOT_DELETE',
        details: {
          doctorId: doctor.id,
          slotId: id,
          dayOfWeek: existingSlot.dayOfWeek,
          timestamp: new Date().toISOString()
        },
        performedBy: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Slot de disponibilidad eliminado correctamente'
    });
  } catch (error) {
    console.error('Error deleting availability slot:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
