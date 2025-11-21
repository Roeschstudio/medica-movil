import { requireAppointmentAccess, requireAuth } from "@/lib/auth-middleware";
import { apiRateLimiter, withRateLimit } from "@/lib/rate-limiting";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  chatRoomsQuerySchema,
  createChatRoomSchema,
  validateQueryParams,
  validateRequestBody,
  ValidationError,
} from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { ErrorLogger } from "@/lib/error-logger";

// GET /api/chat/rooms - Get chat rooms for a user
export const GET = withRateLimit(apiRateLimiter)(
  requireAuth(async (request, context) => {
    try {
      const url = new URL(request.url);
      const queryParams = validateQueryParams(
        url.searchParams,
        chatRoomsQuerySchema
      );

      // Verify user can access the requested user's chat rooms
      if (
        queryParams.userId !== context.user.id &&
        context.user.role !== "ADMIN"
      ) {
        return NextResponse.json(
          {
            error: "Cannot access another user's chat rooms",
            code: "ACCESS_DENIED",
          },
          { status: 403 }
        );
      }

      const supabase = await createSupabaseServerClient();

      // Build query
      let query = supabase
        .from("chat_rooms")
        .select(
          `
          *,
          appointment:appointmentId (
            id,
            scheduledAt,
            type,
            status
          ),
          patient:patientId (
            id,
            name,
            role
          ),
          doctor:doctorId (
            id,
            name,
            doctorProfile (
              specialty
            )
          )
        `,
          { count: "exact" }
        )
        .or(
          `patientId.eq.${queryParams.userId},doctorId.eq.${queryParams.userId}`
        )
        .order("updatedAt", { ascending: false });

      // Apply filters
      if (!queryParams.includeInactive) {
        query = query.eq("isActive", true);
      }
      if (queryParams.appointmentId) {
        query = query.eq("appointmentId", queryParams.appointmentId);
      }

      // Apply pagination
      const offset = (queryParams.page - 1) * queryParams.limit;
      query = query.range(offset, offset + queryParams.limit - 1);

      const { data: chatRooms, error, count } = await query;

      if (error) {
        throw error;
      }

      // Format chat rooms
      const formattedChatRooms = (chatRooms || []).map((room: any) => ({
        ...room,
        doctor: room.doctor
          ? {
              ...room.doctor,
              specialty:
                room.doctor.doctorProfile?.specialty || "Medicina General",
            }
          : undefined,
      }));

      return NextResponse.json({
        chatRooms: formattedChatRooms,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          total: count || 0,
          hasMore: (count || 0) > offset + queryParams.limit,
        },
      });
    } catch (error) {
      ErrorLogger.log({
        error,
        context: "Error fetching chat rooms",
        action: "GET /api/chat/rooms",
        level: "error",
        userId: context?.user?.id
      });

      if (error instanceof ValidationError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            field: error.field,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to fetch chat rooms",
          code: "FETCH_CHAT_ROOMS_ERROR",
        },
        { status: 500 }
      );
    }
  })
);

// POST /api/chat/rooms - Create a new chat room
export const POST = withRateLimit(apiRateLimiter)(async (
  request: NextRequest
) => {
  try {
    const roomData = await validateRequestBody(request, createChatRoomSchema);

    return requireAppointmentAccess(
      () => roomData.appointmentId,
      async (_request, _context) => {
        const supabase = createSupabaseServerClient();

        // Check if chat room already exists for this appointment
        const { data: existingRoom, error: checkError } = await supabase
          .from("chat_rooms")
          .select("id")
          .eq("appointmentId", roomData.appointmentId)
          .single();

        if (checkError && checkError.code !== "PGRST116") {
          throw checkError;
        }

        if (existingRoom) {
          return NextResponse.json(
            {
              error: "Chat room already exists for this appointment",
              code: "CHAT_ROOM_EXISTS",
              chatRoomId: existingRoom.id,
            },
            { status: 409 }
          );
        }

        // Verify appointment participants
        const { data: appointment, error: appointmentError } = await supabase
          .from("appointments")
          .select("patientId, doctorId, status")
          .eq("id", roomData.appointmentId)
          .single();

        if (appointmentError || !appointment) {
          return NextResponse.json(
            {
              error: "Appointment not found",
              code: "APPOINTMENT_NOT_FOUND",
            },
            { status: 404 }
          );
        }

        // Verify the provided patient and doctor IDs match the appointment
        if (
          appointment.patientId !== roomData.patientId ||
          appointment.doctorId !== roomData.doctorId
        ) {
          return NextResponse.json(
            {
              error: "Patient and doctor IDs must match the appointment",
              code: "INVALID_PARTICIPANTS",
            },
            { status: 400 }
          );
        }

        // Create chat room
        const { data: chatRoom, error } = await supabase
          .from("chat_rooms")
          .insert({
            appointmentId: roomData.appointmentId,
            patientId: roomData.patientId,
            doctorId: roomData.doctorId,
            isActive: true,
          })
          .select(
            `
              *,
              appointment:appointmentId (
                id,
                scheduledAt,
                type,
                status
              ),
              patient:patientId (
                id,
                name,
                role
              ),
              doctor:doctorId (
                id,
                name,
                doctorProfile (
                  specialty
                )
              )
            `
          )
          .single();

        if (error) {
          throw error;
        }

        // Format response
        const formattedChatRoom = {
          ...chatRoom,
          doctor: chatRoom.doctor
            ? {
                ...chatRoom.doctor,
                specialty:
                  chatRoom.doctor.doctorProfile?.specialty ||
                  "Medicina General",
              }
            : undefined,
        };

        return NextResponse.json(formattedChatRoom, { status: 201 });
      }
    )(request);
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error creating chat room",
      action: "POST /api/chat/rooms",
      level: "error"
    });

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          field: error.field,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create chat room",
        code: "CREATE_CHAT_ROOM_ERROR",
      },
      { status: 500 }
    );
  }
});
