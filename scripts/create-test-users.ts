import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUsers() {
  console.log('🔄 Creando usuarios de prueba...');

  try {
    // 1. Crear Admin
    console.log('👤 Creando usuario Admin...');
    const adminUser = await prisma.user.upsert({
      where: { email: 'john@doe.com' },
      update: {},
      create: {
        email: 'john@doe.com',
        password: await bcrypt.hash('johndoe123', 12),
        name: 'John Doe',
        phone: '+52 55 1234 5678',
        role: 'ADMIN',
        emailVerified: new Date(),
        phoneVerified: true,
      },
    });
    console.log('✅ Admin creado:', adminUser.email);

    // 2. Crear Paciente
    console.log('👤 Creando usuario Paciente...');
    const patientUser = await prisma.user.upsert({
      where: { email: 'maria.garcia@email.com' },
      update: {},
      create: {
        email: 'maria.garcia@email.com',
        password: await bcrypt.hash('paciente123', 12),
        name: 'María García López',
        phone: '+52 55 2345 6789',
        role: 'PATIENT',
        emailVerified: new Date(),
        phoneVerified: true,
      },
    });

    // Crear perfil de paciente
    await prisma.patient.upsert({
      where: { userId: patientUser.id },
      update: {},
      create: {
        userId: patientUser.id,
        dateOfBirth: new Date('1990-05-15'),
        gender: 'Femenino',
        address: 'Av. Reforma 123, Col. Centro',
        city: 'Ciudad de México',
        state: 'Ciudad de México',
        zipCode: '06000',
        emergencyContact: 'Carlos García',
        emergencyPhone: '+52 55 3456 7890',
      },
    });
    console.log('✅ Paciente creado:', patientUser.email);

    // 3. Crear Doctor
    console.log('👤 Creando usuario Doctor...');
    const doctorUser = await prisma.user.upsert({
      where: { email: 'dra.sofia.martinez@medico.com' },
      update: {},
      create: {
        email: 'dra.sofia.martinez@medico.com',
        password: await bcrypt.hash('doctor123', 12),
        name: 'Dra. Sofía Martínez Hernández',
        phone: '+52 55 4567 8901',
        role: 'DOCTOR',
        emailVerified: new Date(),
        phoneVerified: true,
      },
    });

    // Crear perfil de doctor
    await prisma.doctor.upsert({
      where: { userId: doctorUser.id },
      update: {},
      create: {
        userId: doctorUser.id,
        specialty: 'Medicina General',
        licenseNumber: '12345678',
        bio: 'Médico general con más de 10 años de experiencia en atención primaria. Especialista en medicina preventiva y atención integral del paciente.',
        address: 'Av. Insurgentes Sur 456, Col. Roma Norte',
        city: 'Ciudad de México',
        state: 'Ciudad de México',
        zipCode: '06700',
        acceptsInPerson: true,
        acceptsVirtual: true,
        acceptsHomeVisits: false,
        priceInPerson: 80000, // $800 MXN en centavos
        priceVirtual: 60000,  // $600 MXN en centavos
        firstConsultationFree: false,
        workingHours: {
          monday: [{ from: '09:00', to: '13:00' }, { from: '15:00', to: '18:00' }],
          tuesday: [{ from: '09:00', to: '13:00' }, { from: '15:00', to: '18:00' }],
          wednesday: [{ from: '09:00', to: '13:00' }, { from: '15:00', to: '18:00' }],
          thursday: [{ from: '09:00', to: '13:00' }, { from: '15:00', to: '18:00' }],
          friday: [{ from: '09:00', to: '13:00' }, { from: '15:00', to: '17:00' }],
          saturday: [{ from: '09:00', to: '12:00' }],
          sunday: []
        },
        durationInPerson: 30,
        durationVirtual: 30,
        averageRating: 4.8,
        totalReviews: 127,
        totalAppointments: 450,
        isVerified: true,
        isAvailable: true,
      },
    });
    console.log('✅ Doctor creado:', doctorUser.email);

    // 4. Crear algunas especialidades médicas si no existen
    console.log('🏥 Creando especialidades médicas...');
    const specialties = [
      'Medicina General',
      'Cardiología',
      'Dermatología',
      'Ginecología',
      'Pediatría',
      'Neurología',
      'Oftalmología',
      'Traumatología',
      'Psiquiatría',
      'Endocrinología'
    ];

    for (const specialty of specialties) {
      await prisma.medicalSpecialty.upsert({
        where: { name: specialty },
        update: {},
        create: {
          name: specialty,
        },
      });
    }
    console.log('✅ Especialidades médicas creadas');

    // 5. Crear algunos estados mexicanos si no existen
    console.log('🗺️ Creando estados mexicanos...');
    const states = [
      { name: 'Ciudad de México', code: 'CDMX' },
      { name: 'Estado de México', code: 'MEX' },
      { name: 'Jalisco', code: 'JAL' },
      { name: 'Nuevo León', code: 'NL' },
      { name: 'Puebla', code: 'PUE' },
    ];

    for (const state of states) {
      await prisma.mexicanState.upsert({
        where: { code: state.code },
        update: {},
        create: {
          name: state.name,
          code: state.code,
        },
      });
    }
    console.log('✅ Estados mexicanos creados');

    console.log('\n🎉 ¡Usuarios de prueba creados exitosamente!');
    console.log('\n📋 Credenciales de acceso:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ 👑 ADMIN                                                │');
    console.log('│ Email: john@doe.com                                     │');
    console.log('│ Password: johndoe123                                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 🏥 PACIENTE                                             │');
    console.log('│ Email: maria.garcia@email.com                           │');
    console.log('│ Password: paciente123                                   │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 👩‍⚕️ DOCTOR                                              │');
    console.log('│ Email: dra.sofia.martinez@medico.com                    │');
    console.log('│ Password: doctor123                                     │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('\n🌐 Accede a: http://localhost:3000/iniciar-sesion');

  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 