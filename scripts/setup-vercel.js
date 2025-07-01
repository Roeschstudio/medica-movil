const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupDatabase() {
  try {
    console.log('🔄 Configurando base de datos para Vercel...');

    // Crear usuarios de prueba
    const adminPassword = await bcrypt.hash('johndoe123', 10);
    const patientPassword = await bcrypt.hash('paciente123', 10);
    const doctorPassword = await bcrypt.hash('doctor123', 10);

    // Admin
    await prisma.user.upsert({
      where: { email: 'john@doe.com' },
      update: {},
      create: {
        email: 'john@doe.com',
        name: 'John Doe',
        password: adminPassword,
        role: 'ADMIN',
        emailVerified: new Date(),
      },
    });

    // Paciente
    const patient = await prisma.user.upsert({
      where: { email: 'maria.garcia@email.com' },
      update: {},
      create: {
        email: 'maria.garcia@email.com',
        name: 'María García',
        password: patientPassword,
        role: 'PATIENT',
        emailVerified: new Date(),
      },
    });

    // Doctor
    const doctor = await prisma.user.upsert({
      where: { email: 'dra.sofia.martinez@medico.com' },
      update: {},
      create: {
        email: 'dra.sofia.martinez@medico.com',
        name: 'Dra. Sofía Martínez',
        password: doctorPassword,
        role: 'DOCTOR',
        emailVerified: new Date(),
      },
    });

    // Crear perfil de paciente
    await prisma.patient.upsert({
      where: { userId: patient.id },
      update: {},
      create: {
        userId: patient.id,
        phone: '+52 55 1234 5678',
        dateOfBirth: new Date('1990-05-15'),
        gender: 'FEMALE',
        address: 'Av. Reforma 123, CDMX',
        emergencyContact: 'Juan García - +52 55 8765 4321',
      },
    });

    // Crear especialidades básicas
    const specialties = [
      'Medicina General',
      'Cardiología',
      'Pediatría',
      'Dermatología',
      'Ginecología',
    ];

    for (const specialtyName of specialties) {
      await prisma.specialty.upsert({
        where: { name: specialtyName },
        update: {},
        create: {
          name: specialtyName,
          description: `Especialidad en ${specialtyName}`,
        },
      });
    }

    // Crear perfil de doctor
    const cardiology = await prisma.specialty.findFirst({
      where: { name: 'Cardiología' }
    });

    if (cardiology) {
      await prisma.doctor.upsert({
        where: { userId: doctor.id },
        update: {},
        create: {
          userId: doctor.id,
          specialtyId: cardiology.id,
          licenseNumber: 'MED123456',
          phone: '+52 55 9876 5432',
          experience: 10,
          consultationFee: 500,
          bio: 'Especialista en cardiología con 10 años de experiencia.',
          education: 'Universidad Nacional Autónoma de México',
          languages: ['Español', 'Inglés'],
          isVerified: true,
        },
      });
    }

    // Crear algunos estados de México
    const states = [
      'Ciudad de México',
      'Jalisco',
      'Nuevo León',
      'Estado de México',
      'Puebla',
    ];

    for (const stateName of states) {
      await prisma.state.upsert({
        where: { name: stateName },
        update: {},
        create: {
          name: stateName,
          code: stateName.substring(0, 3).toUpperCase(),
        },
      });
    }

    console.log('✅ Base de datos configurada exitosamente');
    console.log('📋 Cuentas de prueba creadas:');
    console.log('   Admin: john@doe.com / johndoe123');
    console.log('   Paciente: maria.garcia@email.com / paciente123');
    console.log('   Doctor: dra.sofia.martinez@medico.com / doctor123');

  } catch (error) {
    console.error('❌ Error configurando base de datos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase(); 