
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { appointmentId, rating, comment } = body;

    // Validaciones
    if (!appointmentId || !rating) {
      return NextResponse.json(
        { error: 'ID de cita y calificación son requeridos' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'La calificación debe estar entre 1 y 5' },
        { status: 400 }
      );
    }

    // Verificar que la cita existe y está completada
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: true,
        review: true
      }
    });

    if (!appointment) {
      return NextResponse.json(
        { error: 'Cita no encontrada' },
        { status: 404 }
      );
    }

    if (appointment.patientId !== session.user.id) {
      return NextResponse.json(
        { error: 'No autorizado para calificar esta cita' },
        { status: 403 }
      );
    }

    if (appointment.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Solo se pueden calificar citas completadas' },
        { status: 400 }
      );
    }

    if (appointment.review) {
      return NextResponse.json(
        { error: 'Esta cita ya ha sido calificada' },
        { status: 400 }
      );
    }

    // Crear la reseña
    const review = await prisma.review.create({
      data: {
        appointmentId,
        patientId: session.user.id,
        doctorId: appointment.doctorId,
        rating,
        comment: comment?.trim() || null
      }
    });

    // Actualizar estadísticas del doctor
    const doctorReviews = await prisma.review.findMany({
      where: { doctorId: appointment.doctorId }
    });

    const totalReviews = doctorReviews.length;
    const averageRating = doctorReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

    await prisma.doctor.update({
      where: { id: appointment.doctorId },
      data: {
        averageRating: Math.round(averageRating * 10) / 10, // Redondear a 1 decimal
        totalReviews
      }
    });

    return NextResponse.json({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!doctorId) {
      return NextResponse.json(
        { error: 'Doctor ID requerido' },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          doctorId,
          isVisible: true
        },
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
        skip,
        take: limit
      }),
      prisma.review.count({
        where: {
          doctorId,
          isVisible: true
        }
      })
    ]);

    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      patientName: review.patient.name,
      createdAt: review.createdAt
    }));

    return NextResponse.json({
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
