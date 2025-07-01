
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { ConsultationType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      doctorId,
      type,
      scheduledAt,
      notes
    } = body;

    // Validaciones
    if (!doctorId || !type || !scheduledAt) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Verificar que el doctor existe y está disponible
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true
      }
    });

    if (!doctor || !doctor.isAvailable) {
      return NextResponse.json(
        { error: 'Doctor no disponible' },
        { status: 404 }
      );
    }

    // Verificar que acepta el tipo de consulta
    const acceptsType = 
      (type === 'IN_PERSON' && doctor.acceptsInPerson) ||
      (type === 'VIRTUAL' && doctor.acceptsVirtual) ||
      (type === 'HOME_VISIT' && doctor.acceptsHomeVisits);

    if (!acceptsType) {
      return NextResponse.json(
        { error: 'Tipo de consulta no disponible' },
        { status: 400 }
      );
    }

    // Obtener datos del paciente
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Determinar precio y duración
    const price = 
      type === 'IN_PERSON' ? doctor.priceInPerson :
      type === 'VIRTUAL' ? doctor.priceVirtual :
      doctor.priceHomeVisit;

    const duration = 
      type === 'IN_PERSON' ? doctor.durationInPerson :
      type === 'VIRTUAL' ? doctor.durationVirtual :
      doctor.durationHomeVisit;

    if (!price || !duration) {
      return NextResponse.json(
        { error: 'Configuración de consulta incompleta' },
        { status: 400 }
      );
    }

    // Verificar conflictos de horario
    const appointmentStart = new Date(scheduledAt);
    const appointmentEnd = new Date(appointmentStart);
    appointmentEnd.setMinutes(appointmentEnd.getMinutes() + duration);

    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: {
          in: ['PENDING', 'CONFIRMED']
        },
        AND: [
          {
            scheduledAt: {
              lt: appointmentEnd
            }
          },
          {
            scheduledAt: {
              gte: new Date(appointmentStart.getTime() - duration * 60000)
            }
          }
        ]
      }
    });

    if (conflictingAppointment) {
      return NextResponse.json(
        { error: 'Horario no disponible' },
        { status: 409 }
      );
    }

    // Crear la cita
    const appointment = await prisma.appointment.create({
      data: {
        patientId: session.user.id,
        doctorId,
        type: type as ConsultationType,
        scheduledAt: appointmentStart,
        duration,
        price,
        notes,
        patientPhone: user.phone || '',
        patientEmail: user.email,
        status: 'PENDING'
      },
      include: {
        doctor: {
          include: {
            user: true
          }
        },
        patient: true
      }
    });

    return NextResponse.json({
      id: appointment.id,
      doctorName: appointment.doctor.user.name,
      patientName: appointment.patient.name,
      type: appointment.type,
      scheduledAt: appointment.scheduledAt,
      duration: appointment.duration,
      price: appointment.price,
      status: appointment.status,
      notes: appointment.notes
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const where: any = {
      patientId: session.user.id
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          doctor: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          scheduledAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.appointment.count({ where })
    ]);

    const formattedAppointments = appointments.map(appointment => ({
      id: appointment.id,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctor.user.name,
      doctorSpecialty: appointment.doctor.specialty,
      doctorImage: appointment.doctor.profileImage,
      type: appointment.type,
      scheduledAt: appointment.scheduledAt,
      duration: appointment.duration,
      price: appointment.price,
      status: appointment.status,
      notes: appointment.notes,
      patientNotes: appointment.patientNotes,
      doctorNotes: appointment.doctorNotes,
      createdAt: appointment.createdAt
    }));

    return NextResponse.json({
      appointments: formattedAppointments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
