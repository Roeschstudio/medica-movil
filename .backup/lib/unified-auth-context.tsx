"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "./supabase-client";
import { UnifiedUser, unifiedAuthClient } from "./unified-auth-client";

interface UnifiedAuthContextType {
  user: UnifiedUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: "PATIENT" | "DOCTOR" | "ADMIN";
  }) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType | undefined>(
  undefined
);

export function UnifiedAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Usar sistema temporal para pruebas (cambiar a false cuando la DB esté lista)
  const USE_TEMP_AUTH = true;

  // Load user on mount and auth state changes
  useEffect(() => {
    const loadUser = async () => {
      try {
        if (USE_TEMP_AUTH) {
          console.log("🔧 Usando sistema de autenticación temporal");
          logAvailableUsers();
          const currentUser = await unifiedAuthClientTemp.getCurrentUser();
          setUser(currentUser);
        } else {
          const currentUser = await unifiedAuthClient.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    if (USE_TEMP_AUTH) {
      // Para el sistema temporal, usar el listener simplificado
      const {
        data: { subscription },
      } = unifiedAuthClientTemp.onAuthStateChange(setUser);
      return () => subscription.unsubscribe();
    } else {
      // Listen for auth state changes (Supabase)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const currentUser = await unifiedAuthClient.getCurrentUser();
          setUser(currentUser);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    }
  }, [supabase.auth, USE_TEMP_AUTH]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = USE_TEMP_AUTH
        ? await unifiedAuthClientTemp.signIn(email, password)
        : await unifiedAuthClient.signIn(email, password);

      if (result.error) {
        return { error: result.error };
      }

      setUser(result.user);

      // Redirect based on role
      if (result.user?.role === "ADMIN") {
        router.push("/admin");
      } else if (result.user?.role === "DOCTOR") {
        router.push("/doctor/portal");
      } else {
        router.push("/paciente/portal");
      }

      return {};
    } catch (error) {
      console.error("Sign in error:", error);
      return { error: "Error al iniciar sesión" };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: "PATIENT" | "DOCTOR" | "ADMIN";
  }) => {
    setLoading(true);
    try {
      const result = await unifiedAuthClient.signUp(
        data.email,
        data.password,
        data.fullName,
        data.userType
      );

      if (result.error) {
        return { error: result.error };
      }

      setUser(result.user);

      // Redirect to appropriate dashboard
      if (result.user.role === "ADMIN") {
        router.push("/admin");
      } else if (result.user.role === "DOCTOR") {
        router.push("/doctor");
      } else {
        router.push("/paciente");
      }

      return {};
    } catch (error) {
      console.error("Sign up error:", error);
      return { error: "Error al crear la cuenta" };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (USE_TEMP_AUTH) {
        await unifiedAuthClientTemp.signOut();
      } else {
        await unifiedAuthClient.signOut();
      }
      setUser(null);
      router.push("/");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await unifiedAuthClient.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}

export function useUnifiedAuth() {
  const context = useContext(UnifiedAuthContext);
  if (context === undefined) {
    throw new Error("useUnifiedAuth must be used within a UnifiedAuthProvider");
  }
  return context;
}

// Hook for requiring authentication
export function useRequireAuth() {
  const { user, loading } = useUnifiedAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/iniciar-sesion");
    }
  }, [user, loading, router]);

  return { user, loading };
}

// Hook for requiring specific role
export function useRequireRole(role: "PATIENT" | "DOCTOR" | "ADMIN") {
  const { user, loading } = useUnifiedAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/iniciar-sesion");
      } else if (user.role !== role) {
        router.push("/unauthorized");
      }
    }
  }, [user, loading, role, router]);

  return { user, loading };
}
