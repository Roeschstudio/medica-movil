import { UserRole } from "@prisma/client";
import { createSupabaseBrowserClient } from "./supabase-client";

export interface UnifiedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isVerified: boolean;
  provider: "supabase" | "nextauth";
}

export class UnifiedAuthClient {
  private supabase = createSupabaseBrowserClient();

  constructor() {
    // Client-side initialization
  }

  // Get current user from Supabase
  async getCurrentUser(): Promise<UnifiedUser | null> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();

      if (error || !user) {
        console.log("No authenticated user found");
        return null;
      }

      // Get user profile from database
      const { data: profile, error: profileError } = await this.supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        return null;
      }

      return {
        id: user.id,
        email: user.email || "",
        name: profile?.full_name || user.user_metadata?.full_name || "",
        role: profile?.role || UserRole.PATIENT,
        avatar: profile?.avatar_url || user.user_metadata?.avatar_url,
        isVerified: user.email_confirmed_at !== null,
        provider: "supabase",
      };
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  // Sign in with email and password
  async signIn(
    email: string,
    password: string
  ): Promise<{ user: UnifiedUser | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      const user = await this.getCurrentUser();
      return { user, error: null };
    } catch (error) {
      return { user: null, error: "An unexpected error occurred" };
    }
  }

  // Sign up with email and password
  async signUp(
    email: string,
    password: string,
    fullName: string,
    userType: UserRole
  ): Promise<{ user: UnifiedUser | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            user_type: userType,
          },
        },
      });

      if (error) {
        return { user: null, error: error.message };
      }

      // Create user profile in database
      if (data.user) {
        const { error: profileError } = await this.supabase
          .from("users")
          .insert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            role: userType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error("Error creating user profile:", profileError);
        }
      }

      const user = await this.getCurrentUser();
      return { user, error: null };
    } catch (error) {
      return { user: null, error: "An unexpected error occurred" };
    }
  }

  // Sign out
  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      return { error: error?.message || null };
    } catch (error) {
      return { error: "An unexpected error occurred" };
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

  // Get session
  async getSession() {
    try {
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();

      if (error) {
        console.error("Error getting session:", error);
        return null;
      }

      return session;
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (user: UnifiedUser | null) => void) {
    return this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await this.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  }
}

// Export singleton instance for client-side use
export const unifiedAuthClient = new UnifiedAuthClient();
export default unifiedAuthClient;
