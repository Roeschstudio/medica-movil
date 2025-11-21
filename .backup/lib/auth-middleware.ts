import { createSupabaseServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export interface AuthContext {
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
  session: any;
}

export class AuthenticationError extends Error {
  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = "Insufficient permissions") {
    super(message);
    this.name = "AuthorizationError";
  }
}

// Extract user from request - Updated for unified auth
export const getUserFromRequest = async (
  request: NextRequest
): Promise<AuthContext | null> => {
  try {
    // First try to get user from middleware headers (more efficient)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    const userEmail = request.headers.get("x-user-email");

    if (userId && userRole && userEmail) {
      // Get full user details from database
      const supabase = createSupabaseServerClient();
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, role, name, isActive")
        .eq("id", userId)
        .single();

      if (userError || !userData || !userData.isActive) {
        return null;
      }

      return {
        user: userData,
        session: { user: { id: userId, email: userEmail } }, // Minimal session object
      };
    }

    // Fallback to Supabase session (for direct API calls)
    const supabase = createSupabaseServerClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return null;
    }

    // Get user details from database
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, role, name, isActive")
      .eq("email", session.user.email!)
      .single();

    if (userError || !userData || !userData.isActive) {
      return null;
    }

    return {
      user: userData,
      session,
    };
  } catch (error) {
    console.error("Error getting user from request:", error);
    return null;
  }
};

// Authentication middleware
export const requireAuth = (
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authContext = await getUserFromRequest(request);

    if (!authContext) {
      return NextResponse.json(
        {
          error: "Authentication required",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    return handler(request, authContext);
  };
};

// Role-based authorization middleware
export const requireRole = (
  allowedRoles: string[],
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireAuth(async (request: NextRequest, context: AuthContext) => {
    if (!allowedRoles.includes(context.user.role)) {
      return NextResponse.json(
        {
          error: "Insufficient permissions",
          code: "INSUFFICIENT_PERMISSIONS",
          required: allowedRoles,
          current: context.user.role,
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
};

// Resource ownership verification
export const requireResourceOwnership = (
  getResourceOwnerId: (
    request: NextRequest,
    context: AuthContext
  ) => Promise<string | null>,
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireAuth(async (request: NextRequest, context: AuthContext) => {
    const resourceOwnerId = await getResourceOwnerId(request, context);

    if (!resourceOwnerId) {
      return NextResponse.json(
        {
          error: "Resource not found",
          code: "RESOURCE_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Allow access if user owns the resource or is an admin
    if (resourceOwnerId !== context.user.id && context.user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error: "Access denied to this resource",
          code: "ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
};

// Chat room access verification
export const requireChatRoomAccess = (
  getChatRoomId: (request: NextRequest) => string,
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireAuth(async (request: NextRequest, context: AuthContext) => {
    const chatRoomId = getChatRoomId(request);
    const supabase = createSupabaseServerClient();

    // Check if user has access to this chat room
    const { data: chatRoom, error } = await supabase
      .from("chat_rooms")
      .select("id, patientId, doctorId")
      .eq("id", chatRoomId)
      .single();

    if (error || !chatRoom) {
      return NextResponse.json(
        {
          error: "Chat room not found",
          code: "CHAT_ROOM_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Check if user is participant in the chat room or is admin
    const hasAccess =
      chatRoom.patientId === context.user.id ||
      chatRoom.doctorId === context.user.id ||
      context.user.role === "ADMIN";

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Access denied to this chat room",
          code: "CHAT_ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
};

// Appointment access verification
export const requireAppointmentAccess = (
  getAppointmentId: (request: NextRequest) => string,
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireAuth(async (request: NextRequest, context: AuthContext) => {
    const appointmentId = getAppointmentId(request);
    const supabase = createSupabaseServerClient();

    // Check if user has access to this appointment
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("id, patientId, doctorId")
      .eq("id", appointmentId)
      .single();

    if (error || !appointment) {
      return NextResponse.json(
        {
          error: "Appointment not found",
          code: "APPOINTMENT_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Check if user is participant in the appointment or is admin
    const hasAccess =
      appointment.patientId === context.user.id ||
      appointment.doctorId === context.user.id ||
      context.user.role === "ADMIN";

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Access denied to this appointment",
          code: "APPOINTMENT_ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
};

// Admin-only middleware
export const requireAdmin = (
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireRole(["ADMIN"], handler);
};

// Doctor-only middleware
export const requireDoctor = (
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireRole(["DOCTOR", "ADMIN"], handler);
};

// Patient or Doctor middleware
export const requirePatientOrDoctor = (
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireRole(["PATIENT", "DOCTOR", "ADMIN"], handler);
};

// Middleware composition helper
export const compose = (...middlewares: Array<(handler: any) => any>) => {
  return (handler: any) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      handler
    );
  };
};
