import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import multer from 'multer';

// Configure multer for memory storage
const _upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common medical file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});



const uploadFileSchema = z.object({
  appointmentId: z.string(),
  type: z.enum(['STUDY', 'PRESCRIPTION', 'DOCUMENT', 'IMAGE', 'PDF']),
  description: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const appointmentId = formData.get('appointmentId') as string;
    const type = formData.get('type') as string;
    const description = formData.get('description') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate input
    const { appointmentId: validAppointmentId, type: validType, description: validDescription } = 
      uploadFileSchema.parse({ appointmentId, type, description });

    // Verify appointment exists and user has access
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: validAppointmentId,
        OR: [
          { patientId: session.user.id },
          { doctor: { userId: session.user.id } }
        ]
      }
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${originalName}`;
    const filePath = `medical-files/${validAppointmentId}/${fileName}`;

    // In a real implementation, you would upload to a cloud storage service like AWS S3, Google Cloud Storage, or Supabase Storage
    // For this example, we'll simulate the upload and store the file info in the database
    const fileUrl = `/uploads/${filePath}`; // This would be the actual URL from your storage service

    // Create medical file record
    const medicalFile = await prisma.medicalFile.create({
      data: {
        appointmentId: validAppointmentId,
        uploaderId: session.user.id,
        fileName: originalName,
        filePath,
        fileUrl,
        fileSize: buffer.length,
        mimeType: file.type,
        type: validType,
        description: validDescription
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        appointment: {
          include: {
            patient: true,
            doctor: { include: { user: true } }
          }
        }
      }
    });

    // TODO: Implement actual file upload to cloud storage
    // Example with Supabase Storage:
    // const { data, error } = await supabase.storage
    //   .from('medical-files')
    //   .upload(filePath, buffer, {
    //     contentType: file.type,
    //     upsert: false
    //   });

    return NextResponse.json(medicalFile);
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get('appointmentId');
    const type = searchParams.get('type');

    if (!appointmentId) {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 });
    }

    // Verify user has access to the appointment
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        OR: [
          { patientId: session.user.id },
          { doctor: { userId: session.user.id } }
        ]
      }
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Build where clause
    const whereClause: any = { appointmentId };
    if (type) {
      whereClause.type = type;
    }

    // Get medical files
    const medicalFiles = await prisma.medicalFile.findMany({
      where: whereClause,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(medicalFiles);
  } catch (error) {
    console.error('Error fetching medical files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
