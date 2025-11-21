import { authOptions } from "@/lib/unified-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { ChatSecurityAuditor } from "./chat-validation";
import { ErrorLogger } from "./error-handling-utils";

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "DOCTOR" | "PATIENT";
  };
  session: any;
}

export interface ChatRoomAuthContext extends AuthContext {
  chatRoom: {
    id: string;
    appointmentId: string;
    patientId: string;
    doctorId: string;
    isActive: boolean;
  };
  userRole: "patient" | "doctor" | "admin";
}

// Base authentication middleware
export const requireChatAuth = (
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user?.id) {
        ChatSecurityAuditor.logSecurityEvent({
          userId: "unknown",
          action: "unauthorized_chat_access",
          ipAddress: getClientIP(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          details: {
            url: request.url,
            method: request.method,
          },
          severity: "medium",
        });

        return NextResponse.json(
          {
            error: "Authentication required",
            code: "UNAUTHORIZED",
          },
          { status: 401 }
        );
      }

      // Verify user exists and is active
      const supabase = createSupabaseServerClient();
      const { data: user, error } = await supabase
        .from("users")
        .select("id, email, name, role, isActive")
        .eq("id", session.user.id)
        .single();

      if (error || !user || !user.isActive) {
        ChatSecurityAuditor.logSecurityEvent({
          userId: session.user.id,
          action: "inactive_user_access",
          ipAddress: getClientIP(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          details: {
            error: error?.message,
            userActive: user?.isActive,
          },
          severity: "high",
        });

        return NextResponse.json(
          {
            error: "User account is inactive or not found",
            code: "USER_INACTIVE",
          },
          { status: 403 }
        );
      }

      const context: AuthContext = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        session,
      };

      return handler(request, context);
    } catch (error) {
      console.error("Authentication error:", error);

      ChatSecurityAuditor.logSecurityEvent({
        userId: "unknown",
        action: "auth_error",
        ipAddress: getClientIP(request),
        userAgent: request.headers.get("user-agent") || "unknown",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        severity: "high",
      });

      return NextResponse.json(
        {
          error: "Authentication failed",
          code: "AUTH_ERROR",
        },
        { status: 500 }
      );
    }
  };
};

// Chat room access authorization
export const requireChatRoomAccess = (
  chatRoomIdExtractor: (request: NextRequest) => string | Promise<string>,
  handler: (
    request: NextRequest,
    context: ChatRoomAuthContext
  ) => Promise<NextResponse>
) => {
  return requireChatAuth(
    async (request: NextRequest, authContext: AuthContext) => {
      try {
        const chatRoomId = await chatRoomIdExtractor(request);

        if (!chatRoomId) {
          return NextResponse.json(
            {
              error: "Chat room ID is required",
              code: "MISSING_CHAT_ROOM_ID",
            },
            { status: 400 }
          );
        }

        const supabase = createSupabaseServerClient();

        // Get chat room with appointment details
        const { data: chatRoom, error } = await supabase
          .from("chat_rooms")
          .select(
            `
          id,
          appointmentId,
          patientId,
          doctorId,
          isActive,
          appointment:appointments!inner(
            id,
            status,
            scheduledAt,
            patientId,
            doctorId
          )
        `
          )
          .eq("id", chatRoomId)
          .single();

        if (error || !chatRoom) {
          ChatSecurityAuditor.logSecurityEvent({
            userId: authContext.user.id,
            chatRoomId,
            action: "chat_room_not_found",
            ipAddress: getClientIP(request),
            userAgent: request.headers.get("user-agent") || "unknown",
            details: {
              error: error?.message,
              chatRoomId,
            },
            severity: "medium",
          });

          return NextResponse.json(
            {
              error: "Chat room not found",
              code: "CHAT_ROOM_NOT_FOUND",
            },
            { status: 404 }
          );
        }

        // Determine user's role in this chat room
        let userRole: "patient" | "doctor" | "admin";

        if (authContext.user.role === "ADMIN") {
          userRole = "admin";
        } else if (authContext.user.id === chatRoom.patientId) {
          userRole = "patient";
        } else if (authContext.user.id === chatRoom.doctorId) {
          userRole = "doctor";
        } else {
          // User is not a participant in this chat room
          ChatSecurityAuditor.logSecurityEvent({
            userId: authContext.user.id,
            chatRoomId,
            action: "unauthorized_chat_room_access",
            ipAddress: getClientIP(request),
            userAgent: request.headers.get("user-agent") || "unknown",
            details: {
              userRole: authContext.user.role,
              patientId: chatRoom.patientId,
              doctorId: chatRoom.doctorId,
            },
            severity: "high",
          });

          return NextResponse.json(
            {
              error: "Access denied to this chat room",
              code: "CHAT_ROOM_ACCESS_DENIED",
            },
            { status: 403 }
          );
        }

        // Additional authorization checks
        const authResult = await performAdditionalAuthChecks(
          authContext,
          chatRoom,
          userRole,
          request
        );

        if (!authResult.allowed) {
          return NextResponse.json(
            {
              error: authResult.reason,
              code: authResult.code,
            },
            { status: authResult.statusCode }
          );
        }

        const context: ChatRoomAuthContext = {
          ...authContext,
          chatRoom: {
            id: chatRoom.id,
            appointmentId: chatRoom.appointmentId,
            patientId: chatRoom.patientId,
            doctorId: chatRoom.doctorId,
            isActive: chatRoom.isActive,
          },
          userRole,
        };

        return handler(request, context);
      } catch (error) {
        console.error("Chat room authorization error:", error);

        ChatSecurityAuditor.logSecurityEvent({
          userId: authContext.user.id,
          action: "chat_room_auth_error",
          ipAddress: getClientIP(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          details: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          severity: "high",
        });

        return NextResponse.json(
          {
            error: "Authorization failed",
            code: "AUTH_ERROR",
          },
          { status: 500 }
        );
      }
    }
  );
};

// Appointment access authorization
export const requireAppointmentAccess = (
  appointmentIdExtractor: (request: NextRequest) => string | Promise<string>,
  handler: (
    request: NextRequest,
    context: AuthContext & { appointmentId: string }
  ) => Promise<NextResponse>
) => {
  return requireChatAuth(
    async (request: NextRequest, authContext: AuthContext) => {
      try {
        const appointmentId = await appointmentIdExtractor(request);

        if (!appointmentId) {
          return NextResponse.json(
            {
              error: "Appointment ID is required",
              code: "MISSING_APPOINTMENT_ID",
            },
            { status: 400 }
          );
        }

        const supabase = createSupabaseServerClient();

        // Verify appointment access
        const { data: appointment, error } = await supabase
          .from("appointments")
          .select("id, patientId, doctorId, status")
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

        // Check if user has access to this appointment
        const hasAccess =
          authContext.user.role === "ADMIN" ||
          authContext.user.id === appointment.patientId ||
          authContext.user.id === appointment.doctorId;

        if (!hasAccess) {
          ChatSecurityAuditor.logSecurityEvent({
            userId: authContext.user.id,
            action: "unauthorized_appointment_access",
            ipAddress: getClientIP(request),
            userAgent: request.headers.get("user-agent") || "unknown",
            details: {
              appointmentId,
              userRole: authContext.user.role,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
            },
            severity: "high",
          });

          return NextResponse.json(
            {
              error: "Access denied to this appointment",
              code: "APPOINTMENT_ACCESS_DENIED",
            },
            { status: 403 }
          );
        }

        const context = {
          ...authContext,
          appointmentId,
        };

        return handler(request, context);
      } catch (error) {
        console.error("Appointment authorization error:", error);
        return NextResponse.json(
          {
            error: "Authorization failed",
            code: "AUTH_ERROR",
          },
          { status: 500 }
        );
      }
    }
  );
};

// Admin-only access
export const requireAdminAccess = (
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireChatAuth(async (request: NextRequest, context: AuthContext) => {
    if (context.user.role !== "ADMIN") {
      ChatSecurityAuditor.logSecurityEvent({
        userId: context.user.id,
        action: "unauthorized_admin_access",
        ipAddress: getClientIP(request),
        userAgent: request.headers.get("user-agent") || "unknown",
        details: {
          userRole: context.user.role,
          url: request.url,
        },
        severity: "high",
      });

      return NextResponse.json(
        {
          error: "Admin access required",
          code: "ADMIN_ACCESS_REQUIRED",
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
};

// Doctor-only access
export const requireDoctorAccess = (
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) => {
  return requireChatAuth(async (request: NextRequest, context: AuthContext) => {
    if (context.user.role !== "DOCTOR" && context.user.role !== "ADMIN") {
      ChatSecurityAuditor.logSecurityEvent({
        userId: context.user.id,
        action: "unauthorized_doctor_access",
        ipAddress: getClientIP(request),
        userAgent: request.headers.get("user-agent") || "unknown",
        details: {
          userRole: context.user.role,
          url: request.url,
        },
        severity: "medium",
      });

      return NextResponse.json(
        {
          error: "Doctor access required",
          code: "DOCTOR_ACCESS_REQUIRED",
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
};

// Additional authorization checks
async function performAdditionalAuthChecks(
  authContext: AuthContext,
  chatRoom: any,
  userRole: "patient" | "doctor" | "admin",
  request: NextRequest
): Promise<{
  allowed: boolean;
  reason?: string;
  code?: string;
  statusCode?: number;
}> {
  // Check if chat room is active (unless admin)
  if (!chatRoom.isActive && userRole !== "admin") {
    ChatSecurityAuditor.logSecurityEvent({
      userId: authContext.user.id,
      chatRoomId: chatRoom.id,
      action: "inactive_chat_room_access",
      ipAddress: getClientIP(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      details: {
        userRole,
        chatRoomActive: chatRoom.isActive,
      },
      severity: "medium",
    });

    return {
      allowed: false,
      reason: "Chat room is not active",
      code: "CHAT_ROOM_INACTIVE",
      statusCode: 400,
    };
  }

  // Check appointment status
  if (chatRoom.appointment) {
    const appointment = chatRoom.appointment;

    // Only allow access to confirmed or in-progress appointments
    const allowedStatuses = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"];

    if (!allowedStatuses.includes(appointment.status) && userRole !== "admin") {
      return {
        allowed: false,
        reason: "Appointment is not in a valid status for chat access",
        code: "INVALID_APPOINTMENT_STATUS",
        statusCode: 400,
      };
    }

    // Check if appointment is too far in the future (more than 1 hour)
    const appointmentTime = new Date(appointment.scheduledAt);
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    if (appointmentTime > oneHourFromNow && userRole !== "admin") {
      return {
        allowed: false,
        reason: "Chat access not available until 1 hour before appointment",
        code: "CHAT_NOT_YET_AVAILABLE",
        statusCode: 400,
      };
    }
  }

  // Check for suspicious activity patterns
  const recentEvents = ChatSecurityAuditor.getSecurityLogs({
    userId: authContext.user.id,
    since: new Date(Date.now() - 60 * 60 * 1000), // Last hour
  });

  const highSeverityEvents = recentEvents.filter(
    (event) => event.severity === "high" || event.severity === "critical"
  );

  if (highSeverityEvents.length > 5) {
    ChatSecurityAuditor.logSecurityEvent({
      userId: authContext.user.id,
      chatRoomId: chatRoom.id,
      action: "suspicious_activity_detected",
      ipAddress: getClientIP(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      details: {
        recentHighSeverityEvents: highSeverityEvents.length,
        userRole,
      },
      severity: "critical",
    });

    return {
      allowed: false,
      reason: "Account temporarily restricted due to suspicious activity",
      code: "ACCOUNT_RESTRICTED",
      statusCode: 403,
    };
  }

  return { allowed: true };
}

// Utility function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0] || realIp || "unknown";
}

// Permission checking utilities
export const checkChatPermission = async (
  userId: string,
  chatRoomId: string,
  action: "read" | "write" | "admin"
): Promise<boolean> => {
  try {
    const supabase = createSupabaseServerClient();

    const { data: chatRoom, error } = await supabase
      .from("chat_rooms")
      .select("patientId, doctorId, isActive")
      .eq("id", chatRoomId)
      .single();

    if (error || !chatRoom) {
      return false;
    }

    // Get user role
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return false;
    }

    // Admin can do everything
    if (user.role === "ADMIN") {
      return true;
    }

    // Check if user is a participant
    const isParticipant =
      userId === chatRoom.patientId || userId === chatRoom.doctorId;

    if (!isParticipant) {
      return false;
    }

    // Check action-specific permissions
    switch (action) {
      case "read":
        return isParticipant;
      case "write":
        return isParticipant && chatRoom.isActive;
      case "admin":
        return (
          user.role === "ADMIN" ||
          (user.role === "DOCTOR" && userId === chatRoom.doctorId)
        );
      default:
        return false;
    }
  } catch (error) {
    console.error("Permission check error:", error);
    return false;
  }
};
