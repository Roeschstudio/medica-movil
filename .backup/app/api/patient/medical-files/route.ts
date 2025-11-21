import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schemas
const medicalFileFiltersSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  fileType: z.string().optional(),
  uploadedBy: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

const createMedicalFileSchema = z.object({
  appointmentId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['PRESCRIPTION', 'LAB_RESULT', 'IMAGING', 'REPORT', 'OTHER']),
  fileUrl: z.string().url(),
  fileSize: z.number().positive(),
  description: z.string().optional()
});

const updateMedicalFileSchema = z.object({
  fileName: z.string().min(1).max(255).optional(),
  fileType: z.enum(['PRESCRIPTION', 'LAB_RESULT', 'IMAGING', 'REPORT', 'OTHER']).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

// GET /api/patient/medical-files - Get patient's medical files
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filters = medicalFileFiltersSchema.parse({
      appointmentId: searchParams.get('appointmentId'),
      fileType: searchParams.get('fileType'),
      uploadedBy: searchParams.get('uploadedBy'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit')
    });

    // Build where clause based on user role
    const whereClause: any = {
      isActive: true
    };

    if (session.user.role === 'PATIENT') {
      // Patients can only see their own files
      whereClause.appointment = {
        patientId: session.user.id
      };
    } else if (session.user.role === 'DOCTOR') {
      // Doctors can see files from their appointments
      whereClause.appointment = {
        doctorId: session.user.id
      };
    } else if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Rol no autorizado' },
        { status: 403 }
      );
    }

    // Add filters
    if (filters.appointmentId) {
      whereClause.appointmentId = filters.appointmentId;
    }
    
    if (filters.fileType) {
      whereClause.fileType = filters.fileType;
    }
    
    if (filters.uploadedBy) {
      whereClause.uploadedBy = filters.uploadedBy;
    }
    
    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Get total count for pagination
    const total = await prisma.medicalFile.count({ where: whereClause });
    const pages = Math.ceil(total / filters.limit);
    const skip = (filters.page - 1) * filters.limit;

    // Get medical files with related data
    const medicalFiles = await prisma.medicalFile.findMany({
      where: whereClause,
      include: {
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            type: true,
            status: true,
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
        },
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: filters.limit
    });

    // Group files by appointment for better organization
    const filesByAppointment = medicalFiles.reduce((acc, file) => {
      const appointmentId = file.appointmentId;
      if (!acc[appointmentId]) {
        acc[appointmentId] = {
          appointment: file.appointment,
          files: []
        };
      }
      acc[appointmentId].files.push({
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        description: file.description,
        uploadedBy: file.uploadedByUser,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      });
      return acc;
    }, {} as any);

    return NextResponse.json({
      success: true,
      data: {
        medicalFiles,
        filesByAppointment: Object.values(filesByAppointment),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          pages
        },
        summary: {
          totalFiles: total,
          fileTypes: await prisma.medicalFile.groupBy({
            by: ['fileType'],
            where: whereClause,
            _count: {
              fileType: true
            }
          })
        }
      }
    });

  } catch (error) {
    console.error('Error fetching medical files:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/patient/medical-files - Create new medical file
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
    const validatedData = createMedicalFileSchema.parse(body);

    // Verify appointment exists and user has access
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: validatedData.appointmentId,
        OR: [
          { patientId: session.user.id },
          { doctorId: session.user.id },
          // Admins can upload to any appointment
          ...(session.user.role === 'ADMIN' ? [{}] : [])
        ]
      },
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } }
      }
    });

    if (!appointment) {
      return NextResponse.json(
        { error: 'Cita no encontrada o sin acceso' },
        { status: 404 }
      );
    }

    // Check file size limits (10MB max)
    if (validatedData.fileSize > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande (máximo 10MB)' },
        { status: 400 }
      );
    }

    // Create medical file in transaction
    const result = await prisma.$transaction(async (tx) => {
      const medicalFile = await tx.medicalFile.create({
        data: {
          appointmentId: validatedData.appointmentId,
          fileName: validatedData.fileName,
          fileType: validatedData.fileType,
          fileUrl: validatedData.fileUrl,
          fileSize: validatedData.fileSize,
          description: validatedData.description,
          uploadedBy: session.user.id,
          isActive: true
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
          action: 'MEDICAL_FILE_UPLOADED',
          details: {
            fileId: medicalFile.id,
            appointmentId: validatedData.appointmentId,
            fileName: validatedData.fileName,
            fileType: validatedData.fileType,
            fileSize: validatedData.fileSize,
            uploadedBy: session.user.id,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId
          },
          userId: session.user.id
        }
      });

      return medicalFile;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Archivo médico subido correctamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating medical file:', error);
    
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

// PATCH /api/patient/medical-files - Update multiple medical files
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fileIds, ...updateData } = body;
    
    if (!fileIds || !Array.isArray(fileIds)) {
      return NextResponse.json(
        { error: 'Se requiere un array de IDs de archivos' },
        { status: 400 }
      );
    }

    const validatedData = updateMedicalFileSchema.parse(updateData);

    // Build where clause based on user role
    const whereClause: any = {
      id: { in: fileIds }
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

    // Update medical files in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get files to update
      const filesToUpdate = await tx.medicalFile.findMany({
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

      if (filesToUpdate.length === 0) {
        throw new Error('No se encontraron archivos para actualizar');
      }

      // Update files
      const updatedFiles = await tx.medicalFile.updateMany({
        where: whereClause,
        data: {
          ...validatedData,
          updatedAt: new Date()
        }
      });

      // Log admin activity for each file
      for (const file of filesToUpdate) {
        await tx.adminLog.create({
          data: {
            action: 'MEDICAL_FILE_UPDATED',
            details: {
              fileId: file.id,
              appointmentId: file.appointmentId,
              changes: validatedData,
              updatedBy: session.user.id,
              patientId: file.appointment.patientId,
              doctorId: file.appointment.doctorId
            },
            userId: session.user.id
          }
        });
      }

      return { count: updatedFiles.count, files: filesToUpdate };
    });

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: result.count,
        files: result.files
      },
      message: `${result.count} archivo(s) actualizado(s) correctamente`
    });

  } catch (error) {
    console.error('Error updating medical files:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.message === 'No se encontraron archivos para actualizar') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/patient/medical-files - Delete multiple medical files
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fileIds, reason } = body;
    
    if (!fileIds || !Array.isArray(fileIds)) {
      return NextResponse.json(
        { error: 'Se requiere un array de IDs de archivos' },
        { status: 400 }
      );
    }

    // Build where clause based on user role
    const whereClause: any = {
      id: { in: fileIds },
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

    // Soft delete medical files in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get files to delete
      const filesToDelete = await tx.medicalFile.findMany({
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

      if (filesToDelete.length === 0) {
        throw new Error('No se encontraron archivos para eliminar');
      }

      // Soft delete files (mark as inactive)
      const deletedFiles = await tx.medicalFile.updateMany({
        where: whereClause,
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      // Log admin activity for each file
      for (const file of filesToDelete) {
        await tx.adminLog.create({
          data: {
            action: 'MEDICAL_FILE_DELETED',
            details: {
              fileId: file.id,
              appointmentId: file.appointmentId,
              fileName: file.fileName,
              reason: reason || 'Usuario eliminó',
              deletedBy: session.user.id,
              patientId: file.appointment.patientId,
              doctorId: file.appointment.doctorId
            },
            userId: session.user.id
          }
        });
      }

      return { count: deletedFiles.count, files: filesToDelete };
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: result.count,
        files: result.files
      },
      message: `${result.count} archivo(s) eliminado(s) correctamente`
    });

  } catch (error) {
    console.error('Error deleting medical files:', error);
    
    if (error instanceof Error && error.message === 'No se encontraron archivos para eliminar') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
