
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

// Obtener sesión del servidor
export async function getSession() {
  return await getServerSession(authOptions);
}

// Obtener usuario actual
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

// Verificar si el usuario está autenticado
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/iniciar-sesion');
  }
  return session.user;
}

// Verificar rol específico
export async function requireRole(role: UserRole) {
  const user = await requireAuth();
  if (user.role !== role) {
    redirect('/unauthorized');
  }
  return user;
}

// Verificar si es doctor
export async function requireDoctor() {
  return await requireRole(UserRole.DOCTOR);
}

// Verificar si es paciente
export async function requirePatient() {
  return await requireRole(UserRole.PATIENT);
}

// Verificar si es admin
export async function requireAdmin() {
  return await requireRole(UserRole.ADMIN);
}

// Verificar múltiples roles
export async function requireRoles(roles: UserRole[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    redirect('/unauthorized');
  }
  return user;
}
