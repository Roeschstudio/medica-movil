import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import {
  createSupabaseAdminClient,
  createSupabaseBrowserClient,
  createSupabaseServerClient,
} from "./supabase";

// Tipos para Supabase Auth
export interface SupabaseUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  emailVerified?: Date;
  phoneVerified?: boolean;
  isActive?: boolean;
}

// Cliente para el navegador
export const supabaseBrowser = createSupabaseBrowserClient();

// Obtener usuario actual del servidor
export async function getCurrentSupabaseUser(): Promise<SupabaseUser | null> {
  const supabase = createSupabaseServerClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Buscar el usuario en nuestra base de datos
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
      },
    });

    if (!dbUser) {
      return null;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      phone: dbUser.phone || undefined,
      role: dbUser.role,
      emailVerified: dbUser.emailVerified || undefined,
      phoneVerified: dbUser.phoneVerified,
      isActive: dbUser.isActive,
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

// Verificar autenticación
export async function requireSupabaseAuth(): Promise<SupabaseUser> {
  const user = await getCurrentSupabaseUser();

  if (!user || !user.isActive) {
    redirect("/iniciar-sesion");
  }

  return user;
}

// Verificar rol específico
export async function requireSupabaseRole(
  role: UserRole
): Promise<SupabaseUser> {
  const user = await requireSupabaseAuth();

  if (user.role !== role) {
    redirect("/unauthorized");
  }

  return user;
}

// Verificar si es doctor
export async function requireSupabaseDoctor(): Promise<SupabaseUser> {
  return requireSupabaseRole(UserRole.DOCTOR);
}

// Verificar si es paciente
export async function requireSupabasePatient(): Promise<SupabaseUser> {
  return requireSupabaseRole(UserRole.PATIENT);
}

// Verificar si es admin
export async function requireSupabaseAdmin(): Promise<SupabaseUser> {
  return requireSupabaseRole(UserRole.ADMIN);
}

// Verificar múltiples roles
export async function requireSupabaseRoles(
  roles: UserRole[]
): Promise<SupabaseUser> {
  const user = await requireSupabaseAuth();

  if (!roles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}

// Registrar usuario en Supabase y nuestra DB
export async function signUpWithSupabase({
  email,
  password,
  name,
  phone,
  role = UserRole.PATIENT,
}: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: UserRole;
}) {
  const supabase = createSupabaseAdminClient();

  try {
    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          phone,
          role,
        },
      });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Error creating user in Supabase");
    }

    // Crear usuario en nuestra base de datos
    const dbUser = await prisma.user.create({
      data: {
        id: authData.user.id,
        email,
        name,
        phone,
        role,
        emailVerified: new Date(),
        isActive: true,
      },
    });

    return { user: dbUser, supabaseUser: authData.user };
  } catch (error) {
    console.error("Error in signUpWithSupabase:", error);
    throw error;
  }
}

// Iniciar sesión
export async function signInWithSupabase(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// Cerrar sesión
export async function signOutSupabase() {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

// Obtener sesión actual del navegador
export async function getSupabaseSession() {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Error getting session:", error);
    return null;
  }

  return session;
}