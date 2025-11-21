import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import { createSupabaseBrowserClient } from "./supabase-client";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "./supabase-server";

// Unified user interface
export interface UnifiedUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  emailVerified?: Date;
  phoneVerified?: boolean;
  isActive: boolean;
  image?: string;
  doctorProfile?: {
    id: string;
    specialty: string;
    profileImage?: string;
  };
  patientProfile?: {
    id: string;
    dateOfBirth?: Date;
  };
}

// Authentication result interface
export interface AuthResult {
  user: UnifiedUser;
  session: any;
  error?: string;
}

// Unified Authentication Service
export class UnifiedAuthService {
  private static instance: UnifiedAuthService;

  private constructor() {}

  static getInstance(): UnifiedAuthService {
    if (!UnifiedAuthService.instance) {
      UnifiedAuthService.instance = new UnifiedAuthService();
    }
    return UnifiedAuthService.instance;
  }

  // Get current user (works for both server and client)
  async getCurrentUser(): Promise<UnifiedUser | null> {
    try {
      // Try Supabase auth first (primary method)
      const supabase = createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return null;
      }

      return await this.getUserFromDatabase(user.email!);
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  // Get user from database with full profile
  private async getUserFromDatabase(
    email: string
  ): Promise<UnifiedUser | null> {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email },
        include: {
          doctorProfile: {
            select: {
              id: true,
              specialty: true,
              profileImage: true,
            },
          },
          patientProfile: {
            select: {
              id: true,
              dateOfBirth: true,
            },
          },
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
        image: dbUser.doctorProfile?.profileImage,
        doctorProfile: dbUser.doctorProfile || undefined,
        patientProfile: dbUser.patientProfile || undefined,
      };
    } catch (error) {
      console.error("Error fetching user from database:", error);
      return null;
    }
  }

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      // First, verify credentials against our database
      const dbUser = await prisma.user.findUnique({
        where: { email },
        include: {
          doctorProfile: true,
          patientProfile: true,
        },
      });

      if (!dbUser) {
        return {
          user: null as any,
          session: null,
          error: "Usuario no encontrado",
        };
      }

      if (!dbUser.isActive) {
        return {
          user: null as any,
          session: null,
          error: "Cuenta desactivada. Contacte al administrador",
        };
      }

      if (!dbUser.password) {
        return {
          user: null as any,
          session: null,
          error: "Error de autenticación",
        };
      }

      const isPasswordValid = await bcrypt.compare(password, dbUser.password);
      if (!isPasswordValid) {
        return {
          user: null as any,
          session: null,
          error: "Contraseña incorrecta",
        };
      }

      // Sign in with Supabase
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If Supabase auth fails, try to create/update the user in Supabase
        await this.syncUserToSupabase(dbUser);

        // Retry sign in
        const { data: retryData, error: retryError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (retryError) {
          return {
            user: null as any,
            session: null,
            error: retryError.message,
          };
        }

        return {
          user: (await this.getUserFromDatabase(email)) as UnifiedUser,
          session: retryData.session,
        };
      }

      return {
        user: (await this.getUserFromDatabase(email)) as UnifiedUser,
        session: data.session,
      };
    } catch (error) {
      console.error("Error in signIn:", error);
      return {
        user: null as any,
        session: null,
        error: "Error interno del servidor",
      };
    }
  }

  // Sign up new user
  async signUp({
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
  }): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return {
          user: null as any,
          session: null,
          error: "El usuario ya existe",
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user in database first
      const dbUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          role,
          emailVerified: new Date(),
          isActive: true,
        },
        include: {
          doctorProfile: true,
          patientProfile: true,
        },
      });

      // Create user in Supabase Auth
      await this.syncUserToSupabase(dbUser);

      // Sign in the new user
      return await this.signIn(email, password);
    } catch (error) {
      console.error("Error in signUp:", error);
      return {
        user: null as any,
        session: null,
        error: "Error al crear la cuenta",
      };
    }
  }

  // Sync user to Supabase Auth
  private async syncUserToSupabase(dbUser: any) {
    try {
      const supabase = createSupabaseAdminClient();

      // Try to create user in Supabase
      const { data, error } = await supabase.auth.admin.createUser({
        email: dbUser.email,
        password: dbUser.password,
        email_confirm: true,
        user_metadata: {
          name: dbUser.name,
          phone: dbUser.phone,
          role: dbUser.role,
        },
      });

      if (error && !error.message.includes("already registered")) {
        console.error("Error syncing user to Supabase:", error);
      }
    } catch (error) {
      console.error("Error in syncUserToSupabase:", error);
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  // Require authentication
  async requireAuth(): Promise<UnifiedUser> {
    const user = await this.getCurrentUser();

    if (!user || !user.isActive) {
      redirect("/iniciar-sesion");
    }

    return user;
  }

  // Require specific role
  async requireRole(role: UserRole): Promise<UnifiedUser> {
    const user = await this.requireAuth();

    if (user.role !== role) {
      redirect("/unauthorized");
    }

    return user;
  }

  // Require multiple roles
  async requireRoles(roles: UserRole[]): Promise<UnifiedUser> {
    const user = await this.requireAuth();

    if (!roles.includes(user.role)) {
      redirect("/unauthorized");
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
    } catch (error) {
      console.error("Error in getSession:", error);
      return null;
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null && user.isActive;
  }

  // Update user profile
  async updateProfile(
    updates: Partial<UnifiedUser>
  ): Promise<UnifiedUser | null> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      const updatedUser = await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          name: updates.name,
          phone: updates.phone,
          // Add other updatable fields as needed
        },
        include: {
          doctorProfile: true,
          patientProfile: true,
        },
      });

      return await this.getUserFromDatabase(updatedUser.email);
    } catch (error) {
      console.error("Error updating profile:", error);
      return null;
    }
  }
}

// NextAuth compatibility configuration
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const result = await unifiedAuth.signIn(
          credentials.email,
          credentials.password
        );

        if (result.user && !result.error) {
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/iniciar-sesion",
    error: "/iniciar-sesion",
  },
  session: {
    strategy: "jwt",
  },
};

// Export singleton instance
export const unifiedAuth = UnifiedAuthService.getInstance();

// Export convenience functions
export const getCurrentUser = () => unifiedAuth.getCurrentUser();
export const requireAuth = () => unifiedAuth.requireAuth();
export const requireRole = (role: UserRole) => unifiedAuth.requireRole(role);
export const requireRoles = (roles: UserRole[]) =>
  unifiedAuth.requireRoles(roles);
export const requireDoctor = () => unifiedAuth.requireDoctor();
export const requirePatient = () => unifiedAuth.requirePatient();
export const requireAdmin = () => unifiedAuth.requireAdmin();
export const signIn = (email: string, password: string) =>
  unifiedAuth.signIn(email, password);
export const signUp = (data: any) => unifiedAuth.signUp(data);
export const signOut = () => unifiedAuth.signOut();
export const getSession = () => unifiedAuth.getSession();
export const isAuthenticated = () => unifiedAuth.isAuthenticated();
export const updateProfile = (updates: Partial<UnifiedUser>) =>
  unifiedAuth.updateProfile(updates);
