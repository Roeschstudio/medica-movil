import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    let whereClause: any = {};

    // Si es un doctor, solo mostrar sus citas
    if (session.user.role === 'DOCTOR') {
      whereClause.doctorId = session.user.id;
    } 
    // Si es un paciente, solo mostrar sus citas
    else if (session.user.role === 'PATIENT') {
      whereClause.patientId = session.user.id;
    }
    // Si es admin, puede ver todas las citas
    else if (session.user.role === 'ADMIN') {
      if (doctorId) whereClause.doctorId = doctorId;
      if (patientId) whereClause.patientId = patientId;
    }

    if (status) {
      whereClause.status = status;
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      
      whereClause.date = {
        gte: startDate,
        lt: endDate
      };
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        doctor: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        patient: {
          select: {
            name: true,
            email: true,
            phone: true,
            image: true
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' }
      ]
    }).catch((error: any) => {
      console.error('Database error:', error);
      return [];
    });

    // Formatear los datos para el frontend
    const formattedAppointments = appointments.map((appointment: any) => ({
      id: appointment.id,
      patientName: appointment.patient?.name || 'Paciente',
      patientEmail: appointment.patient?.email || '',
      patientPhone: appointment.patient?.phone || null,
      doctorName: appointment.doctor?.user?.name || 'Doctor',
      doctorEmail: appointment.doctor?.user?.email || '',
      type: appointment.type,
      date: appointment.date.toISOString().split('T')[0], // YYYY-MM-DD format
      time: appointment.time,
      status: appointment.status,
      notes: appointment.notes || null,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt
    }));

    return NextResponse.json(formattedAppointments);

  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { doctorId, date, time, type, notes } = body;

    // Validar que el usuario sea un paciente o admin
    if (session.user.role !== 'PATIENT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los pacientes pueden agendar citas' }, { status: 403 });
    }

    // Verificar que el doctor existe
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    }).catch(() => null);

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor no encontrado' }, { status: 404 });
    }

    // Crear la cita
    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        patientId: session.user.id,
        date: new Date(date),
        time,
        type: type || 'presencial',
        status: 'pending',
        notes: notes || null
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        patient: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    }).catch((error: any) => {
      console.error('Error creating appointment:', error);
      throw new Error('Error al crear la cita');
    });

    return NextResponse.json({
      id: appointment.id,
      message: 'Cita agendada exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { appointmentId, status, notes } = body;

    if (!appointmentId || !status) {
      return NextResponse.json({ error: 'ID de cita y estado son requeridos' }, { status: 400 });
    }

    // Verificar que la cita existe
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: true,
        patient: true
      }
    }).catch(() => null);

    if (!existingAppointment) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    // Verificar permisos
    const canUpdate = 
      session.user.role === 'ADMIN' ||
      (session.user.role === 'DOCTOR' && existingAppointment.doctorId === session.user.id) ||
      (session.user.role === 'PATIENT' && existingAppointment.patientId === session.user.id);

    if (!canUpdate) {
      return NextResponse.json({ error: 'No tienes permisos para actualizar esta cita' }, { status: 403 });
    }

    // Actualizar la cita
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        notes: notes || existingAppointment.notes,
        updatedAt: new Date()
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        patient: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    }).catch((error: any) => {
      console.error('Error updating appointment:', error);
      throw new Error('Error al actualizar la cita');
    });

    return NextResponse.json({
      id: updatedAppointment.id,
      status: updatedAppointment.status,
      message: 'Cita actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    );
  }
}
