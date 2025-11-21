import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schemas
const updateMedicalFileSchema = z.object({
  fileName: z.string().min(1).max(255).optional(),
  fileType: z.enum(['PRESCRIPTION', 'LAB_RESULT', 'IMAGING', 'REPORT', 'OTHER']).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

const shareFileSchema = z.object({
  shareWithDoctorId: z.string().uuid().optional(),
  shareWithPatientId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  permissions: z.array(z.enum(['VIEW', 'DOWNLOAD'])).default(['VIEW'])
});

// GET /api/patient/medical-files/[id] - Get specific medical file
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const fileId = params.id;

    // Build where clause based on user role
    const whereClause: any = {
      id: fileId,
      isActive: true
    };
    
    if (session.user.role === 'PATIENT') {
      whereClause.appointment = {
        patientId: session.user.id
      };
    } else if (session.user.role === 'DOCTOR') {
      whereClause.appointment = {
        doctorId: session.user.id
      };
    } else if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Rol no autorizado' },
        { status: 403 }
      );
    }

    const medicalFile = await prisma.medicalFile.findFirst({
      where: whereClause,
      include: {
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            type: true,
            status: true,
            notes: true,
            patient: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                dateOfBirth: true,
                gender: true
              }
            },
            doctor: {
              select: {
                id: true,
                name: true,
                email: true,
                specialty: true,
                cedulaProfesional: true,
                hospitalAdscripcion: true
              }
            }
          }
        },
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true
          }
        }
      }
    });

    if (!medicalFile) {
      return NextResponse.json(
        { error: 'Archivo médico no encontrado' },
        { status: 404 }
      );
    }

    // Log file access for audit purposes
    await prisma.adminLog.create({
      data: {
        action: 'MEDICAL_FILE_ACCESSED',
        details: {
          fileId: medicalFile.id,
          fileName: medicalFile.fileName,
          appointmentId: medicalFile.appointmentId,
          accessedBy: session.user.id,
          accessedAt: new Date().toISOString()
        },
        userId: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      data: medicalFile
    });

  } catch (error) {
    console.error('Error fetching medical file:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PATCH /api/patient/medical-files/[id] - Update specific medical file
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const fileId = params.id;
    const body = await request.json();
    const validatedData = updateMedicalFileSchema.parse(body);

    // Build where clause based on user role
    const whereClause: any = {
      id: fileId,
      isActive: true
    };
    
    if (session.user.role === 'PATIENT') {
      whereClause.appointment = {
        patientId: session.user.id
      };
      whereClause.uploadedBy = session.user.id; // Patients can only update their own uploads
    } else if (session.user.role === 'DOCTOR') {
      whereClause.appointment = {
        doctorId: session.user.id
      };
    } else if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Rol no autorizado' },
        { status: 403 }
      );
    }

    // Check if file exists
    const existingFile = await prisma.medicalFile.findFirst({
      where: whereClause,
      include: {
        appointment: {
          select: {
            id: true,
            patientId: true,
            doctorId: true
          }
        }
      }
    });

    if (!existingFile) {
      return NextResponse.json(
        { error: 'Archivo médico no encontrado' },
        { status: 404 }
      );
    }

    // Update medical file in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedFile = await tx.medicalFile.update({
        where: { id: fileId },
        data: {
          ...validatedData,
          updatedAt: new Date()
        },
        include: {
          appointment: {
            select: {
              id: true,
              scheduledAt: true,
              patient: {
                select: {
                  id: true,
                  name: true
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
          },
          uploadedByUser: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      });

      // Log admin activity
      await tx.adminLog.create({
        data: {
          action: 'MEDICAL_FILE_UPDATED',
          details: {
            fileId,
            appointmentId: existingFile.appointmentId,
            changes: validatedData,
            previousData: {
              fileName: existingFile.fileName,
              fileType: existingFile.fileType,
              description: existingFile.description
            },
            updatedBy: session.user.id,
            patientId: existingFile.appointment.patientId,
            doctorId: existingFile.appointment.doctorId
          },
          userId: session.user.id
        }
      });

      return updatedFile;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Archivo médico actualizado correctamente'
    });

  } catch (error) {
    console.error('Error updating medical file:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/patient/medical-files/[id] - Delete specific medical file
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const fileId = params.id;
    const body = await request.json();
    const { reason } = body;

    // Build where clause based on user role
    const whereClause: any = {
      id: fileId,
      isActive: true
    };
    
    if (session.user.role === 'PATIENT') {
      whereClause.appointment = {
        patientId: session.user.id
      };
      whereClause.uploadedBy = session.user.id; // Patients can only delete their own uploads
    } else if (session.user.role === 'DOCTOR') {
      whereClause.appointment = {
        doctorId: session.user.id
      };
    } else if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Rol no autorizado' },
        { status: 403 }
      );
    }

    // Check if file exists
    const existingFile = await prisma.medicalFile.findFirst({
      where: whereClause,
      include: {
        appointment: {
          select: {
            id: true,
            patientId: true,
            doctorId: true
          }
        }
      }
    });

    if (!existingFile) {
      return NextResponse.json(
        { error: 'Archivo médico no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete medical file in transaction
    const result = await prisma.$transaction(async (tx) => {
      const deletedFile = await tx.medicalFile.update({
        where: { id: fileId },
        data: {
          isActive: false,
          updatedAt: new Date()
        },
        include: {
          appointment: {
            select: {
              id: true,
              scheduledAt: true,
              patient: {
                select: {
                  id: true,
                  name: true
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
          }
        }
      });

      // Log admin activity
      await tx.adminLog.create({
        data: {
          action: 'MEDICAL_FILE_DELETED',
          details: {
            fileId,
            appointmentId: existingFile.appointmentId,
            fileName: existingFile.fileName,
            fileType: existingFile.fileType,
            reason: reason || 'Usuario eliminó',
            deletedBy: session.user.id,
            patientId: existingFile.appointment.patientId,
            doctorId: existingFile.appointment.doctorId
          },
          userId: session.user.id
        }
      });

      return deletedFile;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Archivo médico eliminado correctamente'
    });

  } catch (error) {
    console.error('Error deleting medical file:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/patient/medical-files/[id] - Special operations (share, download)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const fileId = params.id;
    const body = await request.json();
    const { action } = body;

    // Build where clause based on user role
    const whereClause: any = {
      id: fileId,
      isActive: true
    };
    
    if (session.user.role === 'PATIENT') {
      whereClause.appointment = {
        patientId: session.user.id
      };
    } else if (session.user.role === 'DOCTOR') {
      whereClause.appointment = {
        doctorId: session.user.id
      };
    } else if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Rol no autorizado' },
        { status: 403 }
      );
    }

    // Check if file exists
    const medicalFile = await prisma.medicalFile.findFirst({
      where: whereClause,
      include: {
        appointment: {
          select: {
            id: true,
            patientId: true,
            doctorId: true,
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
                email: true,
                specialty: true
              }
            }
          }
        }
      }
    });

    if (!medicalFile) {
      return NextResponse.json(
        { error: 'Archivo médico no encontrado' },
        { status: 404 }
      );
    }

    if (action === 'download') {
      // Generate secure download URL or return file URL
      // In a real implementation, you would generate a signed URL
      
      // Log download activity
      await prisma.adminLog.create({
        data: {
          action: 'MEDICAL_FILE_DOWNLOADED',
          details: {
            fileId,
            fileName: medicalFile.fileName,
            appointmentId: medicalFile.appointmentId,
            downloadedBy: session.user.id,
            downloadedAt: new Date().toISOString(),
            patientId: medicalFile.appointment.patientId,
            doctorId: medicalFile.appointment.doctorId
          },
          userId: session.user.id
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          downloadUrl: medicalFile.fileUrl,
          fileName: medicalFile.fileName,
          fileSize: medicalFile.fileSize,
          expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
        },
        message: 'URL de descarga generada'
      });
    }

    if (action === 'share') {
      const validatedData = shareFileSchema.parse(body);

      // Validate share permissions
      if (session.user.role === 'PATIENT') {
        // Patients can only share with their doctors
        if (validatedData.shareWithDoctorId && 
            validatedData.shareWithDoctorId !== medicalFile.appointment.doctorId) {
          return NextResponse.json(
            { error: 'Solo puedes compartir con el doctor de esta cita' },
            { status: 403 }
          );
        }
      }

      // Create file share record in transaction
      const result = await prisma.$transaction(async (tx) => {
        // For now, we'll just log the share action
        // In a real implementation, you might create a file_shares table
        
        await tx.adminLog.create({
          data: {
            action: 'MEDICAL_FILE_SHARED',
            details: {
              fileId,
              fileName: medicalFile.fileName,
              appointmentId: medicalFile.appointmentId,
              sharedBy: session.user.id,
              sharedWith: validatedData.shareWithDoctorId || validatedData.shareWithPatientId,
              permissions: validatedData.permissions,
              expiresAt: validatedData.expiresAt,
              sharedAt: new Date().toISOString(),
              patientId: medicalFile.appointment.patientId,
              doctorId: medicalFile.appointment.doctorId
            },
            userId: session.user.id
          }
        });

        return {
          fileId,
          sharedWith: validatedData.shareWithDoctorId || validatedData.shareWithPatientId,
          permissions: validatedData.permissions,
          expiresAt: validatedData.expiresAt
        };
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: 'Archivo compartido correctamente'
      });
    }

    return NextResponse.json(
      { error: 'Acción no válida' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing medical file action:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}