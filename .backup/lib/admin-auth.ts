import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireAdminAccess() {
  const supabase = createClient();

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      redirect("/iniciar-sesion");
    }

    if (!session) {
      redirect("/iniciar-sesion");
    }

    // Get user role from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (userError) {
      console.error("User role error:", userError);
      redirect("/unauthorized");
    }

    if (!user || user.role !== "ADMIN") {
      redirect("/unauthorized");
    }

    return { session, user };
  } catch (error) {
    console.error("Admin access check error:", error);
    redirect("/iniciar-sesion");
  }
}

export async function checkAdminAccess() {
  const supabase = createClient();

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return { isAdmin: false, session: null, user: null };
    }

    // Get user role from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (userError || !user) {
      return { isAdmin: false, session, user: null };
    }

    return {
      isAdmin: user.role === "ADMIN",
      session,
      user,
    };
  } catch (error) {
    console.error("Admin access check error:", error);
    return { isAdmin: false, session: null, user: null };
  }
}

export function createAdminClient() {
  const supabase = createClient();

  return {
    ...supabase,

    // Enhanced method for admin operations with automatic logging
    async adminQuery<T>(
      operation: string,
      query: () => Promise<T>,
      targetId?: string,
      targetType?: string
    ): Promise<T> {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No authenticated session");
      }

      try {
        const result = await query();

        // Log admin action
        await supabase.from("admin_actions").insert({
          adminId: session.user.id,
          actionType: operation,
          targetId,
          targetType,
          details: { timestamp: new Date().toISOString() },
        });

        return result;
      } catch (error) {
        console.error(`Admin operation ${operation} failed:`, error);
        throw error;
      }
    },
  };
}