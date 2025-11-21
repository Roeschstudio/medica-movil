import { UserRole } from "@prisma/client";
import { TEMP_TEST_USERS, TempAuthService } from "./temp-auth-for-testing";

export interface UnifiedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isVerified: boolean;
  provider: "temp" | "supabase" | "nextauth";
}

export class UnifiedAuthClientTemp {
  constructor() {
    // Client-side initialization
  }

  // Get current user from temporary storage
  async getCurrentUser(): Promise<UnifiedUser | null> {
    try {
      const tempUser = TempAuthService.getCurrentUser();

      if (!tempUser) {
        return null;
      }

      return {
        id: tempUser.id,
        email: tempUser.email,
        name: tempUser.name,
        role: tempUser.role,
        avatar: undefined,
        isVerified: true, // Todos los usuarios de prueba están verificados
        provider: "temp",
      };
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  // Sign in with email and password (temporary)
  async signIn(
    email: string,
    password: string
  ): Promise<{ user: UnifiedUser | null; error: string | null }> {
    try {
      console.log("🔐 Intentando login temporal con:", email);

      const result = await TempAuthService.signIn(email, password);

      if (result.error || !result.user) {
        console.log("❌ Login fallido:", result.error);
        return { user: null, error: result.error || "Error de autenticación" };
      }

      console.log("✅ Login exitoso para:", result.user.name);

      const user: UnifiedUser = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        avatar: undefined,
        isVerified: true,
        provider: "temp",
      };

      return { user, error: null };
    } catch (error) {
      console.error("Error during temp sign in:", error);
      return { user: null, error: "Error inesperado durante el login" };
    }
  }

  // Sign up (temporary - just show available users)
  async signUp(
    email: string,
    password: string,
    fullName: string,
    userType: UserRole
  ): Promise<{ user: UnifiedUser | null; error: string | null }> {
    return {
      user: null,
      error:
        "Registro no disponible en modo de prueba. Usa uno de los usuarios existentes.",
    };
  }

  // Sign out
  async signOut(): Promise<{ error: string | null }> {
    try {
      TempAuthService.signOut();
      console.log("🚪 Sesión cerrada");
      return { error: null };
    } catch (error) {
      return { error: "Error al cerrar sesión" };
    }
  }

  // Check if user has specific role
  async hasRole(role: UserRole): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === role || false;
  }

  // Require specific role (throws if not authorized)
  async requireRole(role: UserRole): Promise<UnifiedUser> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new Error("Authentication required");
    }

    if (user.role !== role) {
      throw new Error(`Access denied. Required role: ${role}`);
    }

    return user;
  }

  // Convenience methods
  async requireDoctor(): Promise<UnifiedUser> {
    return this.requireRole(UserRole.DOCTOR);
  }

  async requirePatient(): Promise<UnifiedUser> {
    return this.requireRole(UserRole.PATIENT);
  }

  async requireAdmin(): Promise<UnifiedUser> {
    return this.requireRole(UserRole.ADMIN);
  }

  // Get session (temporary)
  async getSession() {
    const user = await this.getCurrentUser();
    return user ? { user } : null;
  }

  // Listen to auth state changes (simplified for temp)
  onAuthStateChange(callback: (user: UnifiedUser | null) => void) {
    // Para el sistema temporal, verificamos periódicamente
    const checkAuth = async () => {
      const user = await this.getCurrentUser();
      callback(user);
    };

    // Verificar inmediatamente
    checkAuth();

    // Verificar cada segundo (solo para desarrollo)
    const interval = setInterval(checkAuth, 1000);

    return {
      data: { subscription: { unsubscribe: () => clearInterval(interval) } },
    };
  }
}

// Export singleton instance for client-side use (temporary)
export const unifiedAuthClientTemp = new UnifiedAuthClientTemp();

// Función para mostrar usuarios disponibles
export function logAvailableUsers() {
  console.log("👥 Usuarios de prueba disponibles:");
  TEMP_TEST_USERS.forEach((user) => {
    console.log(`   ${user.role}: ${user.email} / ${user.password}`);
  });
}
