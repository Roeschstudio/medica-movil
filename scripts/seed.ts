import {
  AppointmentStatus,
  ConsultationType,
  FileType,
  MessageType,
  NotificationType,
  PrismaClient,
  UserRole,
  VideoSessionStatus,
  VideoSessionType,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Estados de México con sus códigos
const mexicanStates = [
  { name: "Aguascalientes", code: "AG" },
  { name: "Baja California", code: "BC" },
  { name: "Baja California Sur", code: "BS" },
  { name: "Campeche", code: "CM" },
  { name: "Chiapas", code: "CS" },
  { name: "Chihuahua", code: "CH" },
  { name: "Ciudad de México", code: "MX" },
  { name: "Coahuila", code: "CO" },
  { name: "Colima", code: "CL" },
  { name: "Durango", code: "DG" },
  { name: "Guanajuato", code: "GT" },
  { name: "Guerrero", code: "GR" },
  { name: "Hidalgo", code: "HG" },
  { name: "Jalisco", code: "JA" },
  { name: "México", code: "EM" },
  { name: "Michoacán", code: "MI" },
  { name: "Morelos", code: "MO" },
  { name: "Nayarit", code: "NA" },
  { name: "Nuevo León", code: "NL" },
  { name: "Oaxaca", code: "OA" },
  { name: "Puebla", code: "PU" },
  { name: "Querétaro", code: "QR" },
  { name: "Quintana Roo", code: "QO" },
  { name: "San Luis Potosí", code: "SL" },
  { name: "Sinaloa", code: "SI" },
  { name: "Sonora", code: "SO" },
  { name: "Tabasco", code: "TB" },
  { name: "Tamaulipas", code: "TM" },
  { name: "Tlaxcala", code: "TL" },
  { name: "Veracruz", code: "VE" },
  { name: "Yucatán", code: "YU" },
  { name: "Zacatecas", code: "ZA" },
];

// Ciudades principales por estado (muestra)
const mexicanCities = {
  "Ciudad de México": [
    "Álvaro Obregón",
    "Azcapotzalco",
    "Benito Juárez",
    "Coyoacán",
    "Cuajimalpa",
    "Cuauhtémoc",
    "Gustavo A. Madero",
    "Iztacalco",
    "Iztapalapa",
    "Magdalena Contreras",
    "Miguel Hidalgo",
    "Milpa Alta",
    "Tláhuac",
    "Tlalpan",
    "Venustiano Carranza",
    "Xochimilco",
  ],
  Jalisco: [
    "Guadalajara",
    "Zapopan",
    "Tlaquepaque",
    "Tonalá",
    "Puerto Vallarta",
    "Tlajomulco de Zúñiga",
    "El Salto",
    "Chapala",
    "Ocotlán",
    "Lagos de Moreno",
    "Tepatitlán de Morelos",
  ],
  "Nuevo León": [
    "Monterrey",
    "Guadalupe",
    "San Nicolás de los Garza",
    "Escobedo",
    "Apodaca",
    "Santa Catarina",
    "San Pedro Garza García",
    "Juárez",
    "Cadereyta Jiménez",
    "García",
  ],
  Puebla: [
    "Puebla",
    "Tehuacán",
    "San Martín Texmelucan",
    "Atlixco",
    "Cholula",
    "Huauchinango",
    "Zacatlán",
    "Teziutlán",
    "San Pedro Cholula",
    "Amozoc",
  ],
  Guanajuato: [
    "León",
    "Irapuato",
    "Celaya",
    "Salamanca",
    "Guanajuato",
    "San Miguel de Allende",
    "Pénjamo",
    "Valle de Santiago",
    "Acámbaro",
    "Silao",
  ],
  Veracruz: [
    "Veracruz",
    "Xalapa",
    "Coatzacoalcos",
    "Córdoba",
    "Poza Rica",
    "Boca del Río",
    "Minatitlán",
    "Orizaba",
    "Tuxpan",
    "Papantla",
  ],
};

// Especialidades médicas mexicanas
const medicalSpecialties = [
  "Medicina General",
  "Medicina Familiar",
  "Medicina Interna",
  "Cardiología",
  "Dermatología",
  "Endocrinología",
  "Gastroenterología",
  "Ginecología y Obstetricia",
  "Neurología",
  "Oftalmología",
  "Ortopedia y Traumatología",
  "Otorrinolaringología",
  "Pediatría",
  "Psiquiatría",
  "Psicología",
  "Radiología",
  "Urología",
  "Anestesiología",
  "Cirugía General",
  "Cirugía Plástica",
  "Neumología",
  "Oncología",
  "Reumatología",
  "Infectología",
  "Nefrología",
  "Hematología",
  "Geriatría",
  "Medicina del Deporte",
  "Medicina del Trabajo",
  "Patología",
  "Medicina Nuclear",
  "Genética Médica",
  "Medicina de Urgencias",
  "Medicina Crítica",
  "Nutriología",
];

// Días festivos mexicanos 2024-2025
const mexicanHolidays = [
  // 2024
  {
    name: "Año Nuevo",
    date: new Date("2024-01-01"),
    isNational: true,
    description: "Celebración del Año Nuevo",
  },
  {
    name: "Día de la Constitución",
    date: new Date("2024-02-05"),
    isNational: true,
    description: "Conmemoración de la Constitución de 1917",
  },
  {
    name: "Natalicio de Benito Juárez",
    date: new Date("2024-03-18"),
    isNational: true,
    description: "Natalicio de Benito Juárez",
  },
  {
    name: "Jueves Santo",
    date: new Date("2024-03-28"),
    isNational: false,
    description: "Semana Santa",
  },
  {
    name: "Viernes Santo",
    date: new Date("2024-03-29"),
    isNational: false,
    description: "Semana Santa",
  },
  {
    name: "Día del Trabajo",
    date: new Date("2024-05-01"),
    isNational: true,
    description: "Día Internacional del Trabajo",
  },
  {
    name: "Día de la Independencia",
    date: new Date("2024-09-16"),
    isNational: true,
    description: "Independencia de México",
  },
  {
    name: "Día de la Revolución",
    date: new Date("2024-11-18"),
    isNational: true,
    description: "Revolución Mexicana",
  },
  {
    name: "Navidad",
    date: new Date("2024-12-25"),
    isNational: true,
    description: "Celebración de la Navidad",
  },

  // 2025
  {
    name: "Año Nuevo",
    date: new Date("2025-01-01"),
    isNational: true,
    description: "Celebración del Año Nuevo",
  },
  {
    name: "Día de la Constitución",
    date: new Date("2025-02-03"),
    isNational: true,
    description: "Conmemoración de la Constitución de 1917",
  },
  {
    name: "Natalicio de Benito Juárez",
    date: new Date("2025-03-17"),
    isNational: true,
    description: "Natalicio de Benito Juárez",
  },
  {
    name: "Jueves Santo",
    date: new Date("2025-04-17"),
    isNational: false,
    description: "Semana Santa",
  },
  {
    name: "Viernes Santo",
    date: new Date("2025-04-18"),
    isNational: false,
    description: "Semana Santa",
  },
  {
    name: "Día del Trabajo",
    date: new Date("2025-05-01"),
    isNational: true,
    description: "Día Internacional del Trabajo",
  },
  {
    name: "Día de la Independencia",
    date: new Date("2025-09-16"),
    isNational: true,
    description: "Independencia de México",
  },
  {
    name: "Día de la Revolución",
    date: new Date("2025-11-17"),
    isNational: true,
    description: "Revolución Mexicana",
  },
  {
    name: "Navidad",
    date: new Date("2025-12-25"),
    isNational: true,
    description: "Celebración de la Navidad",
  },
];

async function main() {
  console.log("🌱 Iniciando seed de la base de datos...");

  // Limpiar datos existentes
  console.log("🧹 Limpiando datos existentes...");
  await prisma.videoSessionParticipant.deleteMany();
  await prisma.videoSession.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.medicalFile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.doctorBlockedDay.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.mexicanHoliday.deleteMany();
  await prisma.medicalSpecialty.deleteMany();
  await prisma.mexicanCity.deleteMany();
  await prisma.mexicanState.deleteMany();

  // 1. Crear especialidades médicas
  console.log("🏥 Creando especialidades médicas...");
  for (const specialty of medicalSpecialties) {
    await prisma.medicalSpecialty.create({
      data: { name: specialty },
    });
  }

  // 2. Crear estados mexicanos
  console.log("🗺️ Creando estados mexicanos...");
  const statesMap = new Map();
  for (const state of mexicanStates) {
    const createdState = await prisma.mexicanState.create({
      data: { name: state.name, code: state.code },
    });
    statesMap.set(state.name, createdState.id);
  }

  // 3. Crear ciudades mexicanas
  console.log("🏙️ Creando ciudades mexicanas...");
  for (const [stateName, cities] of Object.entries(mexicanCities)) {
    const stateId = statesMap.get(stateName);
    if (stateId) {
      for (const city of cities) {
        await prisma.mexicanCity.create({
          data: {
            name: city,
            stateId: stateId,
          },
        });
      }
    }
  }

  // 4. Crear días festivos mexicanos
  console.log("🎉 Creando días festivos mexicanos...");
  for (const holiday of mexicanHolidays) {
    await prisma.mexicanHoliday.create({
      data: {
        name: holiday.name,
        date: holiday.date,
        isNational: holiday.isNational,
        description: holiday.description,
      },
    });
  }

  // 5. Crear usuarios demo
  console.log("👥 Creando usuarios demo...");

  // Usuario admin obligatorio
  const hashedPasswordAdmin = await bcrypt.hash("johndoe123", 12);
  const adminUser = await prisma.user.create({
    data: {
      email: "john@doe.com",
      password: hashedPasswordAdmin,
      name: "John Doe",
      phone: "5512345678",
      role: UserRole.ADMIN,
      emailVerified: new Date(),
      phoneVerified: true,
    },
  });

  // Pacientes de prueba
  const hashedPasswordPatient = await bcrypt.hash("paciente123", 12);
  const patient1 = await prisma.user.create({
    data: {
      email: "maria.garcia@email.com",
      password: hashedPasswordPatient,
      name: "María García López",
      phone: "5587654321",
      role: UserRole.PATIENT,
      emailVerified: new Date(),
      phoneVerified: true,
      patientProfile: {
        create: {
          dateOfBirth: new Date("1985-03-15"),
          gender: "Femenino",
          address: "Av. Insurgentes Sur 1234, Col. Del Valle",
          city: "Benito Juárez",
          state: "Ciudad de México",
          zipCode: "03100",
          emergencyContact: "Roberto García",
          emergencyPhone: "5512348765",
        },
      },
    },
  });

  const patient2 = await prisma.user.create({
    data: {
      email: "carlos.rodriguez@email.com",
      password: hashedPasswordPatient,
      name: "Carlos Rodríguez Hernández",
      phone: "3312345678",
      role: UserRole.PATIENT,
      emailVerified: new Date(),
      phoneVerified: true,
      patientProfile: {
        create: {
          dateOfBirth: new Date("1990-07-22"),
          gender: "Masculino",
          address: "Av. López Mateos 567, Col. Americana",
          city: "Guadalajara",
          state: "Jalisco",
          zipCode: "44160",
          emergencyContact: "Ana Rodríguez",
          emergencyPhone: "3398765432",
        },
      },
    },
  });

  // Doctores de prueba
  const hashedPasswordDoctor = await bcrypt.hash("doctor123", 12);

  const doctor1 = await prisma.user.create({
    data: {
      email: "dra.sofia.martinez@medico.com",
      password: hashedPasswordDoctor,
      name: "Dra. Sofía Martínez Ruiz",
      phone: "5523456789",
      role: UserRole.DOCTOR,
      emailVerified: new Date(),
      phoneVerified: true,
      doctorProfile: {
        create: {
          specialty: "Medicina General",
          licenseNumber: "12345678",
          bio: "Médica general con más de 10 años de experiencia. Especializada en medicina preventiva y atención integral de la familia. Egresada de la UNAM con especialidad en medicina familiar.",
          address: "Consultorio 302, Torre Médica del Valle",
          city: "Benito Juárez",
          state: "Ciudad de México",
          zipCode: "03100",
          acceptsInPerson: true,
          acceptsVirtual: true,
          acceptsHomeVisits: false,
          priceInPerson: 80000, // $800 MXN
          priceVirtual: 60000, // $600 MXN
          firstConsultationFree: true,
          videoCallLink: "https://meet.google.com/sofia-martinez",
          workingHours: {
            monday: [
              { from: "09:00", to: "14:00" },
              { from: "16:00", to: "20:00" },
            ],
            tuesday: [
              { from: "09:00", to: "14:00" },
              { from: "16:00", to: "20:00" },
            ],
            wednesday: [
              { from: "09:00", to: "14:00" },
              { from: "16:00", to: "20:00" },
            ],
            thursday: [
              { from: "09:00", to: "14:00" },
              { from: "16:00", to: "20:00" },
            ],
            friday: [{ from: "09:00", to: "14:00" }],
            saturday: [{ from: "09:00", to: "13:00" }],
            sunday: [],
          },
          durationInPerson: 30,
          durationVirtual: 30,
          isVerified: true,
          averageRating: 4.8,
          totalReviews: 127,
          totalAppointments: 340,
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  const doctor2 = await prisma.user.create({
    data: {
      email: "dr.miguel.hernandez@cardiologo.com",
      password: hashedPasswordDoctor,
      name: "Dr. Miguel Hernández Castro",
      phone: "8123456789",
      role: UserRole.DOCTOR,
      emailVerified: new Date(),
      phoneVerified: true,
      doctorProfile: {
        create: {
          specialty: "Cardiología",
          licenseNumber: "87654321",
          bio: "Cardiólogo certificado con especialidad en arritmias y medicina cardiovascular. Miembro del Colegio de Cardiología de México. Egresado del Tecnológico de Monterrey.",
          address: "Torre de Especialidades, Piso 8, Consultorio 804",
          city: "Monterrey",
          state: "Nuevo León",
          zipCode: "64000",
          acceptsInPerson: true,
          acceptsVirtual: true,
          acceptsHomeVisits: true,
          priceInPerson: 120000, // $1,200 MXN
          priceVirtual: 80000, // $800 MXN
          priceHomeVisit: 180000, // $1,800 MXN
          firstConsultationFree: false,
          videoCallLink: "https://zoom.us/j/miguel-hernandez",
          workingHours: {
            monday: [
              { from: "08:00", to: "12:00" },
              { from: "15:00", to: "19:00" },
            ],
            tuesday: [
              { from: "08:00", to: "12:00" },
              { from: "15:00", to: "19:00" },
            ],
            wednesday: [{ from: "08:00", to: "12:00" }],
            thursday: [
              { from: "08:00", to: "12:00" },
              { from: "15:00", to: "19:00" },
            ],
            friday: [
              { from: "08:00", to: "12:00" },
              { from: "15:00", to: "18:00" },
            ],
            saturday: [],
            sunday: [],
          },
          durationInPerson: 45,
          durationVirtual: 30,
          durationHomeVisit: 60,
          isVerified: true,
          averageRating: 4.9,
          totalReviews: 89,
          totalAppointments: 256,
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  const doctor3 = await prisma.user.create({
    data: {
      email: "dra.ana.lopez@pediatra.com",
      password: hashedPasswordDoctor,
      name: "Dra. Ana López Morales",
      phone: "3334567890",
      role: UserRole.DOCTOR,
      emailVerified: new Date(),
      phoneVerified: true,
      doctorProfile: {
        create: {
          specialty: "Pediatría",
          licenseNumber: "45678912",
          bio: "Pediatra con certificación en neonatología y cuidados intensivos pediátricos. Especialista en el desarrollo infantil y vacunación. Egresada de la Universidad de Guadalajara.",
          address: "Clínica Pediátrica Guadalajara, Consultorio 201",
          city: "Guadalajara",
          state: "Jalisco",
          zipCode: "44100",
          acceptsInPerson: true,
          acceptsVirtual: true,
          acceptsHomeVisits: true,
          priceInPerson: 90000, // $900 MXN
          priceVirtual: 70000, // $700 MXN
          priceHomeVisit: 140000, // $1,400 MXN
          firstConsultationFree: false,
          videoCallLink: "https://meet.google.com/ana-lopez-pediatra",
          workingHours: {
            monday: [
              { from: "09:00", to: "13:00" },
              { from: "16:00", to: "20:00" },
            ],
            tuesday: [
              { from: "09:00", to: "13:00" },
              { from: "16:00", to: "20:00" },
            ],
            wednesday: [
              { from: "09:00", to: "13:00" },
              { from: "16:00", to: "20:00" },
            ],
            thursday: [
              { from: "09:00", to: "13:00" },
              { from: "16:00", to: "20:00" },
            ],
            friday: [
              { from: "09:00", to: "13:00" },
              { from: "16:00", to: "18:00" },
            ],
            saturday: [{ from: "09:00", to: "14:00" }],
            sunday: [],
          },
          durationInPerson: 30,
          durationVirtual: 25,
          durationHomeVisit: 45,
          isVerified: true,
          averageRating: 4.7,
          totalReviews: 203,
          totalAppointments: 567,
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  // 6. Crear algunas citas de ejemplo
  console.log("📅 Creando citas de ejemplo...");

  // Cita completada con reseña
  const completedAppointment = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      doctorId: doctor1.doctorProfile?.id || "",
      type: ConsultationType.IN_PERSON,
      scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Hace 7 días
      duration: 30,
      status: AppointmentStatus.COMPLETED,
      price: 80000,
      notes: "Consulta de seguimiento",
      patientNotes: "Dolor de cabeza recurrente",
      doctorNotes: "Paciente estable, continuar tratamiento",
      patientPhone: patient1.phone!,
      patientEmail: patient1.email,
    },
  });

  // Crear reseña para la cita completada
  await prisma.review.create({
    data: {
      appointmentId: completedAppointment.id,
      patientId: patient1.id,
      doctorId: doctor1.doctorProfile?.id || "",
      rating: 5,
      comment:
        "Excelente atención, muy profesional y empática. La doctora me explicó todo muy claramente y me sentí muy cómoda durante la consulta.",
    },
  });

  // Cita pendiente
  const pendingAppointment = await prisma.appointment.create({
    data: {
      patientId: patient2.id,
      doctorId: doctor2.doctorProfile?.id || "",
      type: ConsultationType.VIRTUAL,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // En 3 días
      duration: 45,
      status: AppointmentStatus.PENDING,
      price: 80000,
      notes: "Primera consulta cardiológica",
      patientNotes: "Dolor en el pecho ocasional",
      patientPhone: patient2.phone!,
      patientEmail: patient2.email,
    },
  });

  // Cita confirmada
  const confirmedAppointment = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      doctorId: doctor3.doctorProfile?.id || "",
      type: ConsultationType.HOME_VISIT,
      scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // En 5 días
      duration: 45,
      status: AppointmentStatus.CONFIRMED,
      price: 140000,
      notes: "Revisión pediátrica a domicilio",
      patientNotes: "Control de crecimiento del bebé",
      patientPhone: patient1.phone!,
      patientEmail: patient1.email,
    },
  });

  // 7. Crear chat rooms para las citas
  console.log("💬 Creando chat rooms para las citas...");

  // Chat room para la cita completada
  const completedChatRoom = await prisma.chatRoom.create({
    data: {
      appointmentId: completedAppointment.id,
      patientId: patient1.id,
      doctorId: doctor1.doctorProfile?.id || "",
      isActive: false, // Terminado porque la cita está completada
      startedAt: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000
      ), // 30 min antes de la cita
      endedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hora después de la cita
    },
  });

  // Chat room para la cita pendiente
  const pendingChatRoom = await prisma.chatRoom.create({
    data: {
      appointmentId: pendingAppointment.id,
      patientId: patient2.id,
      doctorId: doctor2.doctorProfile?.id || "",
      isActive: true,
      startedAt: new Date(), // Recién creado
    },
  });

  // Chat room para la cita confirmada
  const confirmedChatRoom = await prisma.chatRoom.create({
    data: {
      appointmentId: confirmedAppointment.id,
      patientId: patient1.id,
      doctorId: doctor3.doctorProfile?.id || "",
      isActive: true,
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
    },
  });

  // 8. Crear mensajes de chat de ejemplo
  console.log("📝 Creando mensajes de chat de ejemplo...");

  // Mensajes para el chat completado (conversación histórica)
  await prisma.chatMessage.create({
    data: {
      chatRoomId: completedChatRoom.id,
      senderId: patient1.id,
      content: "Hola doctora, tengo algunas dudas antes de mi cita de mañana.",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // Hace 8 días
      isRead: true,
    },
  });

  await prisma.chatMessage.create({
    data: {
      chatRoomId: completedChatRoom.id,
      senderId: doctor1.id,
      content: "¡Hola María! Por supuesto, dime en qué te puedo ayudar.",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000), // 15 min después
      isRead: true,
    },
  });

  await prisma.chatMessage.create({
    data: {
      chatRoomId: completedChatRoom.id,
      senderId: patient1.id,
      content:
        "He estado tomando el medicamento que me recetó, pero sigo teniendo dolores de cabeza por las mañanas.",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000),
      isRead: true,
    },
  });

  await prisma.chatMessage.create({
    data: {
      chatRoomId: completedChatRoom.id,
      senderId: doctor1.id,
      content:
        "Entiendo. Vamos a revisar eso en la consulta. ¿Has notado si hay algún patrón específico con los dolores?",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000),
      isRead: true,
    },
  });

  // Mensajes para el chat pendiente (conversación activa)
  await prisma.chatMessage.create({
    data: {
      chatRoomId: pendingChatRoom.id,
      senderId: patient2.id,
      content:
        "Buenos días doctor, soy Carlos Rodríguez. Tengo programada una cita para el miércoles.",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Hace 2 horas
      isRead: true,
    },
  });

  await prisma.chatMessage.create({
    data: {
      chatRoomId: pendingChatRoom.id,
      senderId: doctor2.id,
      content:
        "Buenos días Carlos. Sí, veo su cita programada. ¿En qué le puedo ayudar?",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 90 * 60 * 1000), // Hace 1.5 horas
      isRead: true,
    },
  });

  await prisma.chatMessage.create({
    data: {
      chatRoomId: pendingChatRoom.id,
      senderId: patient2.id,
      content:
        "He estado sintiendo dolor en el pecho cuando hago ejercicio. ¿Debería preocuparme?",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 80 * 60 * 1000),
      isRead: true,
    },
  });

  await prisma.chatMessage.create({
    data: {
      chatRoomId: pendingChatRoom.id,
      senderId: doctor2.id,
      content:
        "Es importante que lo evaluemos. Por favor, evite ejercicio intenso hasta nuestra consulta. ¿Ha tenido otros síntomas como falta de aire o mareos?",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 70 * 60 * 1000),
      isRead: false, // Mensaje no leído por el paciente
    },
  });

  // Mensajes para el chat confirmado
  await prisma.chatMessage.create({
    data: {
      chatRoomId: confirmedChatRoom.id,
      senderId: doctor3.id,
      content:
        "Hola María, soy la Dra. López. Veo que tiene programada una visita domiciliaria para el control de su bebé.",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // Hace 2 días + 30 min
      isRead: true,
    },
  });

  await prisma.chatMessage.create({
    data: {
      chatRoomId: confirmedChatRoom.id,
      senderId: patient1.id,
      content:
        "¡Hola doctora! Sí, muchas gracias. Mi bebé tiene 4 meses y queremos asegurarnos de que todo esté bien con su desarrollo.",
      messageType: MessageType.TEXT,
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
      isRead: true,
    },
  });

  // 9. Crear archivos médicos de ejemplo
  console.log("📄 Creando archivos médicos de ejemplo...");

  // Crear algunos archivos de ejemplo (simulados)
  await prisma.medicalFile.create({
    data: {
      appointmentId: completedAppointment.id,
      uploadedBy: patient1.id,
      fileName: "estudios_sangre_maria.pdf",
      fileUrl: "https://example.com/files/estudios_sangre_maria.pdf", // URL simulada
      fileType: FileType.STUDY,
      fileSize: 2048576, // 2MB
      mimeType: "application/pdf",
      isVisible: true,
    },
  });

  await prisma.medicalFile.create({
    data: {
      appointmentId: pendingAppointment.id,
      uploadedBy: patient2.id,
      fileName: "electrocardiograma_carlos.jpg",
      fileUrl: "https://example.com/files/electrocardiograma_carlos.jpg", // URL simulada
      fileType: FileType.IMAGE,
      fileSize: 1536000, // 1.5MB
      mimeType: "image/jpeg",
      isVisible: true,
    },
  });

  await prisma.medicalFile.create({
    data: {
      appointmentId: confirmedAppointment.id,
      uploadedBy: doctor3.id,
      fileName: "cartilla_vacunacion_bebe.pdf",
      fileUrl: "https://example.com/files/cartilla_vacunacion_bebe.pdf", // URL simulada
      fileType: FileType.DOCUMENT,
      fileSize: 512000, // 512KB
      mimeType: "application/pdf",
      isVisible: true,
    },
  });

  // 10. Crear sesiones de video de ejemplo
  console.log("🎥 Creando sesiones de video de ejemplo...");

  // Sesión de video completada para la cita completada
  const completedVideoSession = await prisma.videoSession.create({
    data: {
      chatRoomId: completedChatRoom.id,
      sessionId: "session_completed_" + Date.now(),
      roomName: "Consulta María García - Dra. Sofía Martínez",
      type: VideoSessionType.CONSULTATION,
      status: VideoSessionStatus.ENDED,
      initiatorId: doctor1.id,
      duration: 1800, // 30 minutos
      startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Hace 7 días
      endedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 min después
      recordingUrl: "https://example.com/recordings/session_completed.mp4", // URL simulada
    },
  });

  // Participantes de la sesión completada
  await prisma.videoSessionParticipant.create({
    data: {
      videoSessionId: completedVideoSession.id,
      userId: doctor1.id,
      joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      leftAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      isConnected: false,
    },
  });

  await prisma.videoSessionParticipant.create({
    data: {
      videoSessionId: completedVideoSession.id,
      userId: patient1.id,
      joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 1000), // 2 min después
      leftAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      isConnected: false,
    },
  });

  // Sesión de video programada para la cita pendiente
  const pendingVideoSession = await prisma.videoSession.create({
    data: {
      chatRoomId: pendingChatRoom.id,
      sessionId: "session_pending_" + Date.now(),
      roomName: "Consulta Carlos Rodríguez - Dr. Miguel Hernández",
      type: VideoSessionType.CONSULTATION,
      status: VideoSessionStatus.WAITING,
      initiatorId: doctor2.id,
      duration: 0,
      startedAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // En 3 días
    },
  });

  // Participantes programados
  await prisma.videoSessionParticipant.create({
    data: {
      videoSessionId: pendingVideoSession.id,
      userId: doctor2.id,
      isConnected: false,
    },
  });

  await prisma.videoSessionParticipant.create({
    data: {
      videoSessionId: pendingVideoSession.id,
      userId: patient2.id,
      isConnected: false,
    },
  });

  // 11. Crear notificaciones adicionales relacionadas con chat
  console.log("🔔 Creando notificaciones de chat...");

  await prisma.notification.create({
    data: {
      userId: patient2.id,
      type: NotificationType.EMAIL,
      title: "Nuevo mensaje del Dr. Hernández",
      message: "Ha recibido un nuevo mensaje en el chat de su cita programada",
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: patient1.id,
      type: NotificationType.SMS,
      title: "Archivo médico subido",
      message: "La Dra. López ha subido la cartilla de vacunación actualizada",
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: doctor1.id,
      type: NotificationType.EMAIL,
      title: "Sesión de video completada",
      message: "La grabación de su consulta con María García está disponible",
      isRead: true,
    },
  });

  // 12. Crear algunas notificaciones de ejemplo adicionales
  console.log("🔔 Creando notificaciones de ejemplo...");

  await prisma.notification.create({
    data: {
      userId: patient1.id,
      type: "EMAIL",
      title: "Cita confirmada",
      message:
        "Su cita con la Dra. Ana López ha sido confirmada para el próximo viernes a las 10:00 AM",
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: doctor1.id,
      type: "EMAIL",
      title: "Nueva reseña recibida",
      message:
        "Ha recibido una nueva reseña de 5 estrellas de María García López",
      isRead: false,
    },
  });

  console.log("✅ Seed completado exitosamente!");
  console.log("");
  console.log("👤 Usuarios demo creados:");
  console.log("   Admin: john@doe.com / johndoe123");
  console.log("   Paciente 1: maria.garcia@email.com / paciente123");
  console.log("   Paciente 2: carlos.rodriguez@email.com / paciente123");
  console.log("   Doctor 1: dra.sofia.martinez@medico.com / doctor123");
  console.log("   Doctor 2: dr.miguel.hernandez@cardiologo.com / doctor123");
  console.log("   Doctor 3: dra.ana.lopez@pediatra.com / doctor123");
  console.log("");
  console.log("📊 Datos creados:");
  console.log(`   Estados: ${mexicanStates.length}`);
  console.log(`   Ciudades: ${Object.values(mexicanCities).flat().length}`);
  console.log(`   Especialidades médicas: ${medicalSpecialties.length}`);
  console.log(`   Días festivos: ${mexicanHolidays.length}`);
  console.log("   Usuarios: 6 (1 admin, 2 pacientes, 3 doctores)");
  console.log("   Citas: 3");
  console.log("   Reseñas: 1");
  console.log("   Chat rooms: 3");
  console.log("   Mensajes de chat: 9");
  console.log("   Archivos médicos: 3");
  console.log("   Sesiones de video: 2");
  console.log("   Participantes de video: 4");
  console.log("   Notificaciones: 5");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
