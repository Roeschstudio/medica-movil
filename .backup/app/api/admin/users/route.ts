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
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Construir filtros de forma más robusta
    const where: any = {};
    
    if (role && role !== 'all') {
      where.role = role;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Obtener usuarios con paginación de forma más robusta
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          doctorProfile: {
            select: {
              specialty: true,
              isVerified: true,
              city: true,
              state: true
            }
          }
        }
      }).catch((error: any) => {
        console.error('Error fetching users:', error);
        return [];
      }),
      prisma.user.count({ where }).catch((error: any) => {
        console.error('Error counting users:', error);
        return 0;
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      users: users.map((user: any) => ({
        id: user.id,
        name: user.name || 'Sin nombre',
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        createdAt: user.createdAt,
        doctor: user.doctorProfile ? {
          specialty: user.doctorProfile.specialty || 'Sin especialidad',
          isVerified: user.doctorProfile.isVerified || false,
          city: user.doctorProfile.city || 'Sin ciudad',
          state: user.doctorProfile.state || 'Sin estado'
        } : null
      })),
      pagination: {
        page,
        limit,
        total,
        pages: totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
