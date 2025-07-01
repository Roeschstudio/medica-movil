import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { 
          patient: { 
            name: { contains: search, mode: 'insensitive' } 
          } 
        },
        { 
          doctor: { 
            name: { contains: search, mode: 'insensitive' } 
          } 
        }
      ];
    }

    // Obtener citas con paginación
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true
            }
          }
        }
      }),
      prisma.appointment.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      appointments: appointments.map((appointment: any) => ({
        id: appointment.id,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        consultationType: appointment.consultationType,
        notes: appointment.notes,
        createdAt: appointment.createdAt,
        patient: {
          id: appointment.patient.id,
          name: appointment.patient.name,
          email: appointment.patient.email
        },
        doctor: {
          id: appointment.doctor.id,
          name: appointment.doctor.name,
          specialty: appointment.doctor.specialty
        }
      })),
      pagination: {
        page,
        limit,
        total,
        pages: totalPages
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