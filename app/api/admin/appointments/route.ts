import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/db';

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic';

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

    // Construir filtros de forma más robusta
    const where: Record<string, unknown> = {};
    
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
            user: {
              name: { contains: search, mode: 'insensitive' }
            }
          } 
        }
      ];
    }

    // Obtener citas con paginación de forma más robusta
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
              specialty: true,
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }).catch((_error: unknown) => {
        return [];
      }),
      prisma.appointment.count({ where }).catch((_error: unknown) => {
        return 0;
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      appointments: appointments.map((appointment: Record<string, unknown>) => ({
        id: appointment.id,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        consultationType: appointment.type,
        notes: appointment.notes || '',
        createdAt: appointment.createdAt,
        patient: {
          id: appointment.patient?.id || '',
          name: appointment.patient?.name || 'Sin nombre',
          email: appointment.patient?.email || 'Sin email'
        },
        doctor: {
          id: appointment.doctor?.id || '',
          name: appointment.doctor?.user?.name || 'Sin nombre',
          specialty: appointment.doctor?.specialty || 'Sin especialidad'
        }
      })),
      pagination: {
        page,
        limit,
        total,
        pages: totalPages
      }
    });

  } catch (_error) {
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: _error instanceof Error ? _error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
