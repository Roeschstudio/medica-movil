import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateProfileSchema = z.object({
  bio: z.string().optional(),
  experience: z.number().min(0).optional(),
  consultationFee: z.number().min(0).optional(),
  specialtyId: z.string().optional(),
  cedulaProfesional: z.string().optional(),
  numeroIMSS: z.string().optional(),
  hospitalAdscripcion: z.string().optional(),
  turno: z.enum(['MATUTINO', 'VESPERTINO', 'NOCTURNO', 'JORNADA_ACUMULADA']).optional(),
  categoria: z.enum(['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'MEDICO_FAMILIAR', 'RESIDENTE', 'INTERNO']).optional()
});

// GET /api/doctor/profile - Get doctor profile
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

    const doctor = await prisma.doctor.findUnique({
      where: {
        userId: session.user.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        specialty: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            appointments: true,
            chatRooms: true,
            videoSessions: true
          }
        }
      }
    });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Perfil de doctor no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      doctor
    });
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PATCH /api/doctor/profile - Update doctor profile
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
    const validatedData = updateProfileSchema.parse(body);

    // Check if doctor exists
    const existingDoctor = await prisma.doctor.findUnique({
      where: {
        userId: session.user.id
      }
    });

    if (!existingDoctor) {
      return NextResponse.json(
        { error: 'Perfil de doctor no encontrado' },
        { status: 404 }
      );
    }

    // Validate specialty if provided
    if (validatedData.specialtyId) {
      const specialty = await prisma.specialty.findUnique({
        where: { id: validatedData.specialtyId }
      });

      if (!specialty) {
        return NextResponse.json(
          { error: 'Especialidad no válida' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate cedula profesional if provided
    if (validatedData.cedulaProfesional && validatedData.cedulaProfesional !== existingDoctor.cedulaProfesional) {
      const existingCedula = await prisma.doctor.findFirst({
        where: {
          cedulaProfesional: validatedData.cedulaProfesional,
          id: { not: existingDoctor.id }
        }
      });

      if (existingCedula) {
        return NextResponse.json(
          { error: 'La cédula profesional ya está registrada' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate numero IMSS if provided
    if (validatedData.numeroIMSS && validatedData.numeroIMSS !== existingDoctor.numeroIMSS) {
      const existingIMSS = await prisma.doctor.findFirst({
        where: {
          numeroIMSS: validatedData.numeroIMSS,
          id: { not: existingDoctor.id }
        }
      });

      if (existingIMSS) {
        return NextResponse.json(
          { error: 'El número IMSS ya está registrado' },
          { status: 400 }
        );
      }
    }

    // Update doctor profile
    const updatedDoctor = await prisma.doctor.update({
      where: {
        userId: session.user.id
      },
      data: {
        ...validatedData,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        specialty: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            appointments: true,
            chatRooms: true,
            videoSessions: true
          }
        }
      }
    });

    // Log the profile update
    await prisma.adminLog.create({
      data: {
        action: 'DOCTOR_PROFILE_UPDATE',
        details: {
          doctorId: updatedDoctor.id,
          updatedFields: Object.keys(validatedData),
          timestamp: new Date().toISOString()
        },
        performedBy: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Perfil actualizado correctamente',
      doctor: updatedDoctor
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

    console.error('Error updating doctor profile:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/doctor/profile - Complete IMSS registration
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
    const { cedulaProfesional, numeroIMSS, hospitalAdscripcion, turno, categoria } = body;

    // Validate required IMSS fields
    if (!cedulaProfesional || !numeroIMSS || !hospitalAdscripcion) {
      return NextResponse.json(
        { error: 'Todos los campos IMSS son requeridos' },
        { status: 400 }
      );
    }

    // Check if doctor exists
    const existingDoctor = await prisma.doctor.findUnique({
      where: {
        userId: session.user.id
      }
    });

    if (!existingDoctor) {
      return NextResponse.json(
        { error: 'Perfil de doctor no encontrado' },
        { status: 404 }
      );
    }

    // Check for duplicate cedula profesional
    const existingCedula = await prisma.doctor.findFirst({
      where: {
        cedulaProfesional,
        id: { not: existingDoctor.id }
      }
    });

    if (existingCedula) {
      return NextResponse.json(
        { error: 'La cédula profesional ya está registrada' },
        { status: 400 }
      );
    }

    // Check for duplicate numero IMSS
    const existingIMSS = await prisma.doctor.findFirst({
      where: {
        numeroIMSS,
        id: { not: existingDoctor.id }
      }
    });

    if (existingIMSS) {
      return NextResponse.json(
        { error: 'El número IMSS ya está registrado' },
        { status: 400 }
      );
    }

    // Update doctor with IMSS information
    const updatedDoctor = await prisma.doctor.update({
      where: {
        userId: session.user.id
      },
      data: {
        cedulaProfesional,
        numeroIMSS,
        hospitalAdscripcion,
        turno,
        categoria,
        isActive: true, // Activate doctor once IMSS info is complete
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        specialty: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log the IMSS completion
    await prisma.adminLog.create({
      data: {
        action: 'DOCTOR_IMSS_COMPLETED',
        details: {
          doctorId: updatedDoctor.id,
          cedulaProfesional,
          numeroIMSS,
          hospitalAdscripcion,
          timestamp: new Date().toISOString()
        },
        performedBy: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Información IMSS completada correctamente',
      doctor: updatedDoctor
    });
  } catch (error) {
    console.error('Error completing IMSS registration:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
