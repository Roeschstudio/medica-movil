
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { validateMexicanPhone } from '@/lib/mexican-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, password, userType } = body;

    // Validar datos requeridos
    if (!name || !email || !phone || !password || !userType) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
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

    // Validar teléfono mexicano
    const phoneValidation = validateMexicanPhone(phone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Número de teléfono inválido' },
        { status: 400 }
      );
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

    // Verificar si el teléfono ya existe
    const existingUserByPhone = await prisma.user.findUnique({
      where: { phone: phoneValidation.formatted }
    });

    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'Este número de teléfono ya está registrado' },
        { status: 409 }
      );
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Determinar el rol del usuario
    const role = userType === 'doctor' ? UserRole.DOCTOR : UserRole.PATIENT;

    // Crear el usuario
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phoneValidation.formatted,
        password: hashedPassword,
        role: role,
        emailVerified: new Date(), // Auto-verificar por ahora
        phoneVerified: true
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

    // Remover la contraseña de la respuesta
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      message: 'Cuenta creada exitosamente',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Error en registro:', error);
    
    // Manejar errores específicos de Prisma
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'El email o teléfono ya están registrados' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
