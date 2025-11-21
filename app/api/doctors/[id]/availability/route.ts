
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { addDays, format, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const consultationType = searchParams.get('type') || 'IN_PERSON';

    if (!dateStr) {
      return NextResponse.json(
        { error: 'Fecha requerida' },
        { status: 400 }
      );
    }

    const requestedDate = parseISO(dateStr);
    
    // Obtener doctor
    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      include: {
        blockedDays: {
          where: {
            date: {
              gte: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate()),
              lt: addDays(requestedDate, 1)
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

    // Verificar si acepta este tipo de consulta
    const acceptsType = 
      (consultationType === 'IN_PERSON' && doctor.acceptsInPerson) ||
      (consultationType === 'VIRTUAL' && doctor.acceptsVirtual) ||
      (consultationType === 'HOME_VISIT' && doctor.acceptsHomeVisits);

    if (!acceptsType) {
      return NextResponse.json({
        available: false,
        reason: 'Tipo de consulta no disponible',
        slots: []
      });
    }

    // Verificar si el día está bloqueado
    if (doctor.blockedDays.length > 0) {
      return NextResponse.json({
        available: false,
        reason: doctor.blockedDays[0].reason || 'Día no disponible',
        slots: []
      });
    }

    // Verificar días festivos
    const holiday = await prisma.mexicanHoliday.findFirst({
      where: {
        date: {
          gte: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate()),
          lt: addDays(requestedDate, 1)
        }
      }
    });

    if (holiday) {
      return NextResponse.json({
        available: false,
        reason: `Día festivo: ${holiday.name}`,
        slots: []
      });
    }

    // Obtener horarios de trabajo
    const workingHours = doctor.workingHours as any;
    const dayOfWeek = format(requestedDate, 'EEEE').toLowerCase();
    const daySchedule = workingHours?.[dayOfWeek];

    if (!daySchedule || daySchedule.length === 0) {
      return NextResponse.json({
        available: false,
        reason: 'Día no laborable',
        slots: []
      });
    }

    // Obtener citas existentes para ese día
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: params.id,
        scheduledAt: {
          gte: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate()),
          lt: addDays(requestedDate, 1)
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      }
    });

    // Generar slots disponibles
    const duration = 
      consultationType === 'IN_PERSON' ? doctor.durationInPerson :
      consultationType === 'VIRTUAL' ? doctor.durationVirtual :
      doctor.durationHomeVisit;

    const slots = [];
    
    for (const schedule of daySchedule) {
      const startTime = parseTime(schedule.from);
      const endTime = parseTime(schedule.to);
      
      let currentTime = startTime;
      
      while (currentTime + duration <= endTime) {
        const slotStart = new Date(requestedDate);
        slotStart.setHours(Math.floor(currentTime / 60), currentTime % 60, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + duration);

        // Verificar si el slot está ocupado
        const isOccupied = existingAppointments.some(appointment => {
          const appointmentStart = new Date(appointment.scheduledAt);
          const appointmentEnd = new Date(appointmentStart);
          appointmentEnd.setMinutes(appointmentEnd.getMinutes() + appointment.duration);

          return (
            (slotStart >= appointmentStart && slotStart < appointmentEnd) ||
            (slotEnd > appointmentStart && slotEnd <= appointmentEnd) ||
            (slotStart <= appointmentStart && slotEnd >= appointmentEnd)
          );
        });

        if (!isOccupied && slotStart > new Date()) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            available: true
          });
        }

        currentTime += duration;
      }
    }

    return NextResponse.json({
      available: slots.length > 0,
      slots,
      price: 
        consultationType === 'IN_PERSON' ? doctor.priceInPerson :
        consultationType === 'VIRTUAL' ? doctor.priceVirtual :
        doctor.priceHomeVisit
    });

  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
