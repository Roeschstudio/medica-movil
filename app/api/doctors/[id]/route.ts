
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        reviews: {
          include: {
            patient: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        blockedDays: {
          where: {
            date: {
              gte: new Date()
            }
          }
        }
      }
    });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Doctor no encontrado' },
        { status: 404 }
      );
    }

    const formattedDoctor = {
      id: doctor.id,
      userId: doctor.userId,
      name: doctor.user.name,
      email: doctor.user.email,
      phone: doctor.user.phone,
      specialty: doctor.specialty,
      licenseNumber: doctor.licenseNumber,
      bio: doctor.bio,
      city: doctor.city,
      state: doctor.state,
      address: doctor.address,
      zipCode: doctor.zipCode,
      profileImage: doctor.profileImage,
      averageRating: doctor.averageRating,
      totalReviews: doctor.totalReviews,
      totalAppointments: doctor.totalAppointments,
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
      workingHours: doctor.workingHours,
      videoCallLink: doctor.videoCallLink,
      reviews: doctor.reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        patientName: review.patient.name,
        createdAt: review.createdAt
      })),
      blockedDays: doctor.blockedDays.map(blocked => ({
        id: blocked.id,
        date: blocked.date,
        reason: blocked.reason
      }))
    };

    return NextResponse.json(formattedDoctor);

  } catch (error) {
    console.error('Error fetching doctor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
