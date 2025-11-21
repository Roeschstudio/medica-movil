import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { validateMexicanPhone } from '@/lib/mexican-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, password, userType } = body;

    // Validar datos requeridos
    if (!name || !email || !password || !userType) {
      return NextResponse.json(
        { error: 'Nombre, email, contraseña y tipo de usuario son requeridos' },
        { status: 400 }
      );
    }

    // Validar tipo de usuario
    if (!['patient', 'doctor'].includes(userType)) {
      return NextResponse.json(
        { error: 'Tipo de usuario inválido' },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
    }

    // Validar teléfono mexicano (OPCIONAL)
    let formattedPhone = null;
    if (phone && phone.trim()) {
      const phoneValidation = validateMexicanPhone(phone);
      if (!phoneValidation.isValid) {
        return NextResponse.json(
          { error: phoneValidation.error || 'Número de teléfono inválido' },
          { status: 400 }
        );
      }
      formattedPhone = phoneValidation.formatted;
    }

    // Validar contraseña
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'Este correo electrónico ya está registrado' },
        { status: 409 }
      );
    }

    // Verificar si el teléfono ya existe (solo si se proporcionó)
    if (formattedPhone) {
      const existingUserByPhone = await prisma.user.findUnique({
        where: { phone: formattedPhone }
      });

      if (existingUserByPhone) {
        return NextResponse.json(
          { error: 'Este número de teléfono ya está registrado' },
          { status: 409 }
        );
      }
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determinar el rol basado en el tipo de usuario
    const role = userType === 'doctor' ? 'DOCTOR' : 'PATIENT';

    // Crear el usuario
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: formattedPhone,
        password: hashedPassword,
        role: role,
        emailVerified: new Date(), // Auto-verificar para desarrollo
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      }
    });

    // Crear perfil extendido según el tipo de usuario
    if (userType === 'patient') {
      await prisma.patient.create({
        data: {
          userId: user.id
        }
      });
    } else if (userType === 'doctor') {
      // Para doctores, crear un perfil básico que completarán después
      await prisma.doctor.create({
        data: {
          userId: user.id,
          specialty: '', // Se completará en el siguiente paso
          city: '',
          state: '',
          acceptsInPerson: true,
          acceptsVirtual: false,
          acceptsHomeVisits: false,
          durationInPerson: 30,
          durationVirtual: 30,
          durationHomeVisit: 60,
          isVerified: false, // Requiere verificación manual
          isAvailable: false // No disponible hasta completar perfil
        }
      });
    }

    return NextResponse.json({
      message: 'Usuario registrado exitosamente',
      user
    }, { status: 201 });

  } catch (error) {
    console.error('Error en registro:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
