
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ErrorLogger } from '@/lib/error-logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const specialty = searchParams.get('specialty') || '';
    const state = searchParams.get('state') || '';
    const city = searchParams.get('city') || '';
    const consultationType = searchParams.get('consultationType') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: {
      isAvailable: boolean;
      user: { isActive: boolean };
      OR?: Array<{
        user?: { name?: { contains: string; mode: string } };
        specialty?: { contains: string; mode: string };
      }>;
      specialty?: string;
      state?: string;
      city?: string;
      acceptsInPerson?: boolean;
      acceptsVirtual?: boolean;
      acceptsHomeVisits?: boolean;
    } = {
      isAvailable: true,
      user: {
        isActive: true
      }
    };

    if (search) {
      where.OR = [
        {
          user: {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          specialty: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (specialty && specialty !== 'all') {
      where.specialty = specialty;
    }

    if (state && state !== 'all') {
      where.state = state;
    }

    if (city && city !== 'all') {
      where.city = city;
    }

    if (consultationType && consultationType !== 'all') {
      switch (consultationType) {
        case 'IN_PERSON':
          where.acceptsInPerson = true;
          break;
        case 'VIRTUAL':
          where.acceptsVirtual = true;
          break;
        case 'HOME_VISIT':
          where.acceptsHomeVisits = true;
          break;
      }
    }

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        },
        orderBy: [
          { isVerified: 'desc' },
          { averageRating: 'desc' },
          { totalReviews: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.doctor.count({ where })
    ]);

    const formattedDoctors = doctors.map(doctor => ({
      id: doctor.id,
      userId: doctor.userId,
      name: doctor.user.name,
      email: doctor.user.email,
      phone: doctor.user.phone,
      specialty: doctor.specialty,
      city: doctor.city,
      state: doctor.state,
      profileImage: doctor.profileImage,
      bio: doctor.bio,
      averageRating: doctor.averageRating,
      totalReviews: doctor.totalReviews,
      acceptsInPerson: doctor.acceptsInPerson,
      acceptsVirtual: doctor.acceptsVirtual,
      acceptsHomeVisits: doctor.acceptsHomeVisits,
      priceInPerson: doctor.priceInPerson,
      priceVirtual: doctor.priceVirtual,
      priceHomeVisit: doctor.priceHomeVisit,
      firstConsultationFree: doctor.firstConsultationFree,
      isVerified: doctor.isVerified,
      durationInPerson: doctor.durationInPerson,
      durationVirtual: doctor.durationVirtual,
      durationHomeVisit: doctor.durationHomeVisit,
      workingHours: doctor.workingHours
    }));

    return NextResponse.json({
      doctors: formattedDoctors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error fetching doctors",
      action: "GET /api/doctors",
      level: "error"
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
