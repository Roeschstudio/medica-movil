// Sistema de autenticación temporal para pruebas (sin base de datos)
// Este archivo se puede eliminar una vez que la base de datos esté funcionando

export interface TempUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "DOCTOR" | "PATIENT";
  password: string; // Solo para pruebas, nunca hacer esto en producción
}

// Usuarios de prueba hardcodeados
export const TEMP_TEST_USERS: TempUser[] = [
  {
    id: "admin-1",
    email: "admin@medicamovil.mx",
    name: "Administrador Sistema",
    role: "ADMIN",
    password: "admin123",
  },
  {
    id: "admin-2",
    email: "john@doe.com",
    name: "John Doe",
    role: "ADMIN",
    password: "johndoe123",
  },
  {
    id: "patient-1",
    email: "maria.garcia@email.com",
    name: "María García López",
    role: "PATIENT",
    password: "paciente123",
  },
  {
    id: "doctor-1",
    email: "dra.sofia.martinez@medico.com",
    name: "Dra. Sofía Martínez",
    role: "DOCTOR",
    password: "doctor123",
  },
];

export class TempAuthService {
  // Simular login
  static async signIn(
    email: string,
    password: string
  ): Promise<{ user: TempUser | null; error: string | null }> {
    // Simular delay de red
    await new Promise((resolve) => setTimeout(resolve, 500));

    const user = TEMP_TEST_USERS.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!user) {
      return {
        user: null,
        error: "Credenciales incorrectas. Usa uno de los usuarios de prueba.",
      };
    }

    // Guardar en localStorage para simular sesión
    localStorage.setItem(
      "temp_auth_user",
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      })
    );

    return { user, error: null };
  }

  // Obtener usuario actual
  static getCurrentUser(): TempUser | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem("temp_auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  // Cerrar sesión
  static signOut(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("temp_auth_user");
    }
  }

  // Verificar si está autenticado
  static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }
}

// Función para mostrar información de usuarios de prueba
export function getTestUsersInfo(): string {
  return `
Usuarios de prueba disponibles:

🔑 ADMINISTRADORES:
   • admin@medicamovil.mx / admin123
   • john@doe.com / johndoe123

👤 PACIENTE:
   • maria.garcia@email.com / paciente123

👨‍⚕️ DOCTOR:
   • dra.sofia.martinez@medico.com / doctor123

Nota: Este es un sistema temporal para pruebas.
Una vez que la base de datos esté configurada, estos usuarios
deberán crearse en Supabase.
  `.trim();
}
