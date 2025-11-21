import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const specialty = searchParams.get('specialty');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const imssStatus = searchParams.get('imssStatus');
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {};
    
    if (status && status !== 'all') {
      where.isActive = status === 'active';
    }
    
    if (specialty && specialty !== 'all') {
      where.specialtyId = specialty;
    }
    
    if (imssStatus) {
      if (imssStatus === 'complete') {
        where.AND = [
          { cedulaProfesional: { not: null } },
          { numeroIMSS: { not: null } },
          { hospitalAdscripcion: { not: null } }
        ];
      } else if (imssStatus === 'incomplete') {
        where.OR = [
          { cedulaProfesional: null },
          { numeroIMSS: null },
          { hospitalAdscripcion: null }
        ];
      }
    }
    
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
          user: {
            email: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          cedulaProfesional: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          numeroIMSS: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }
    
    // Build order by clause
    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.user = { name: sortOrder };
    } else if (sortBy === 'specialty') {
      orderBy.specialty = { name: sortOrder };
    } else if (sortBy === 'rating') {
      orderBy.rating = sortOrder;
    } else if (sortBy === 'totalAppointments') {
      orderBy.totalAppointments = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }
    
    // Get doctors with related data
    const [doctors, totalCount] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: {
          user: true,
          specialty: true,
          _count: {
            select: {
              appointments: true,
              chatRooms: true,
              videoSessions: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      
      prisma.doctor.count({ where })
    ]);
    
    // Get additional statistics for each doctor
    const doctorsWithStats = await Promise.all(
      doctors.map(async (doctor) => {
        const [recentAppointments, earnings, reviews] = await Promise.all([
          prisma.appointment.count({
            where: {
              doctorId: doctor.id,
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          }),
          
          prisma.payment.aggregate({
            where: {
              appointment: {
                doctorId: doctor.id
              },
              status: 'COMPLETED'
            },
            _sum: {
              amount: true
            }
          }),
          
          prisma.review.aggregate({
            where: {
              appointment: {
                doctorId: doctor.id
              }
            },
            _avg: {
              rating: true
            },
            _count: {
              id: true
            }
          })
        ]);
        
        // Check IMSS profile completion
        const imssComplete = !!(doctor.cedulaProfesional && 
                               doctor.numeroIMSS && 
                               doctor.hospitalAdscripcion);
        
        return {
          id: doctor.id,
          isActive: doctor.isActive,
          createdAt: doctor.createdAt,
          updatedAt: doctor.updatedAt,
          user: {
            id: doctor.user.id,
            name: doctor.user.name,
            email: doctor.user.email,
            image: doctor.user.image,
            emailVerified: doctor.user.emailVerified
          },
          specialty: doctor.specialty ? {
            id: doctor.specialty.id,
            name: doctor.specialty.name
          } : null,
          imssInfo: {
            cedulaProfesional: doctor.cedulaProfesional,
            numeroIMSS: doctor.numeroIMSS,
            hospitalAdscripcion: doctor.hospitalAdscripcion,
            turno: doctor.turno,
            categoria: doctor.categoria,
            isComplete: imssComplete
          },
          stats: {
            totalAppointments: doctor._count.appointments,
            recentAppointments,
            totalChatRooms: doctor._count.chatRooms,
            totalVideoSessions: doctor._count.videoSessions,
            totalEarnings: earnings._sum.amount || 0,
            averageRating: reviews._avg.rating || 0,
            totalReviews: reviews._count.id
          },
          rating: doctor.rating,
          bio: doctor.bio,
          experience: doctor.experience,
          consultationFee: doctor.consultationFee
        };
      })
    );
    
    // Get summary statistics
    const summary = {
      total: totalCount,
      active: await prisma.doctor.count({
        where: { isActive: true }
      }),
      inactive: await prisma.doctor.count({
        where: { isActive: false }
      }),
      imssComplete: await prisma.doctor.count({
        where: {
          AND: [
            { cedulaProfesional: { not: null } },
            { numeroIMSS: { not: null } },
            { hospitalAdscripcion: { not: null } }
          ]
        }
      }),
      imssIncomplete: await prisma.doctor.count({
        where: {
          OR: [
            { cedulaProfesional: null },
            { numeroIMSS: null },
            { hospitalAdscripcion: null }
          ]
        }
      })
    };
    
    return NextResponse.json({
      doctors: doctorsWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary
    });
    
  } catch (error) {
    console.error('Admin doctors list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update doctor status or information
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { doctorId, action, data, reason } = await request.json();
    
    if (!doctorId || !action) {
      return NextResponse.json(
        { error: 'Doctor ID and action are required' },
        { status: 400 }
      );
    }
    
    // Verify doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
        specialty: true
      }
    });
    
    if (!doctor) {
      return NextResponse.json(
        { error: 'Doctor not found' },
        { status: 404 }
      );
    }
    
    let updateData: any = {};
    let logMessage = '';
    
    switch (action) {
      case 'activate':
        updateData = { isActive: true };
        logMessage = 'Doctor account activated by admin';
        break;
        
      case 'deactivate':
        updateData = { isActive: false };
        logMessage = `Doctor account deactivated by admin. Reason: ${reason || 'No reason provided'}`;
        break;
        
      case 'updateProfile':
        if (data) {
          updateData = {
            bio: data.bio,
            experience: data.experience,
            consultationFee: data.consultationFee,
            specialtyId: data.specialtyId
          };
          logMessage = 'Doctor profile updated by admin';
        }
        break;
        
      case 'updateIMSS':
        if (data) {
          updateData = {
            cedulaProfesional: data.cedulaProfesional,
            numeroIMSS: data.numeroIMSS,
            hospitalAdscripcion: data.hospitalAdscripcion,
            turno: data.turno,
            categoria: data.categoria
          };
          logMessage = 'Doctor IMSS information updated by admin';
        }
        break;
        
      case 'resetPassword':
        // This would typically involve sending a password reset email
        logMessage = 'Password reset initiated by admin';
        // Implementation would depend on your auth system
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    // Update doctor in transaction
    const updatedDoctor = await prisma.$transaction(async (tx) => {
      const updated = await tx.doctor.update({
        where: { id: doctorId },
        data: updateData,
        include: {
          user: true,
          specialty: true
        }
      });
      
      return updated;
    });
    
    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: session.user.id,
        action: `doctor_${action}`,
        targetType: 'DOCTOR',
        targetId: doctorId,
        details: {
          doctorId,
          action,
          reason,
          data,
          doctorName: doctor.user.name,
          doctorEmail: doctor.user.email
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      doctor: updatedDoctor,
      message: `Doctor ${action} completed successfully`
    });
    
  } catch (error) {
    console.error('Admin doctor update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create new doctor account
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const {
      name,
      email,
      specialtyId,
      bio,
      experience,
      consultationFee,
      cedulaProfesional,
      numeroIMSS,
      hospitalAdscripcion,
      turno,
      categoria
    } = await request.json();
    
    if (!name || !email || !specialtyId) {
      return NextResponse.json(
        { error: 'Name, email, and specialty are required' },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }
    
    // Verify specialty exists
    const specialty = await prisma.specialty.findUnique({
      where: { id: specialtyId }
    });
    
    if (!specialty) {
      return NextResponse.json(
        { error: 'Invalid specialty' },
        { status: 400 }
      );
    }
    
    // Create user and doctor in transaction
    const newDoctor = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          name,
          email,
          role: 'DOCTOR',
          emailVerified: new Date() // Admin-created accounts are pre-verified
        }
      });
      
      // Create doctor profile
      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          specialtyId,
          bio: bio || '',
          experience: experience || 0,
          consultationFee: consultationFee || 0,
          cedulaProfesional,
          numeroIMSS,
          hospitalAdscripcion,
          turno,
          categoria,
          isActive: true,
          rating: 0
        },
        include: {
          user: true,
          specialty: true
        }
      });
      
      return doctor;
    });
    
    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: session.user.id,
        action: 'doctor_create',
        targetType: 'DOCTOR',
        targetId: newDoctor.id,
        details: {
          doctorId: newDoctor.id,
          doctorName: name,
          doctorEmail: email,
          specialtyId,
          specialtyName: specialty.name
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      doctor: newDoctor,
      message: 'Doctor account created successfully'
    });
    
  } catch (error) {
    console.error('Admin doctor creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
