import { requireChatRoomAccess } from "@/lib/chat-auth-middleware";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  chatMessagesQuerySchema,
  validateQueryParams,
  ValidationError,
  validateRequestBody,
  chatMessageSchema,
  sanitizeContent,
} from "@/lib/validation";
import { withRateLimit, userChatRateLimiter } from "@/lib/rate-limiting";
import { NextRequest, NextResponse } from "next/server";

// GET /api/chat/messages - Get messages for a chat room
export const GET = withRateLimit(userChatRateLimiter)(
  requireChatRoomAccess(
    (request) => {
      const url = new URL(request.url);
      return url.searchParams.get("chatRoomId") || "";
    },
    async (request, context) => {
      try {
        const url = new URL(request.url);
        const queryParams = validateQueryParams(
          url.searchParams,
          chatMessagesQuerySchema
        );

        const supabase = createSupabaseServerClient();

        // Build query
        let query = supabase
          .from("chat_messages")
          .select(
            `
            *,
            sender:senderId (
              id,
              name,
              role
            )
          `
          )
          .eq("chatRoomId", queryParams.chatRoomId)
          .order("sentAt", { ascending: false });

        // Apply filters
        if (queryParams.messageType) {
          query = query.eq("messageType", queryParams.messageType);
        }
        if (queryParams.senderId) {
          query = query.eq("senderId", queryParams.senderId);
        }
        if (queryParams.isRead !== undefined) {
          query = query.eq("isRead", queryParams.isRead);
        }
        if (queryParams.dateFrom) {
          query = query.gte("sentAt", queryParams.dateFrom);
        }
        if (queryParams.dateTo) {
          query = query.lte("sentAt", queryParams.dateTo);
        }

        // Apply pagination
        const offset = (queryParams.page - 1) * queryParams.limit;
        query = query.range(offset, offset + queryParams.limit - 1);

        const { data: messages, error, count } = await query;

        if (error) {
          throw error;
        }

        return NextResponse.json({
          messages: (messages || []).reverse(), // Reverse to show oldest first
          pagination: {
            page: queryParams.page,
            limit: queryParams.limit,
            total: count || 0,
            hasMore: (count || 0) > offset + queryParams.limit,
          },
        });
      } catch (error) {
        console.error("Error fetching messages:", error);

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
            error: "Failed to fetch messages",
            code: "FETCH_MESSAGES_ERROR",
          },
          { status: 500 }
        );
      }
    }
  )
);

// POST /api/chat/messages - Send a new message
export const POST = withRateLimit(userChatRateLimiter)(
  async (request: NextRequest) => {
    try {
      const messageData = await validateRequestBody(request, chatMessageSchema);

      // Sanitize content
      if (messageData.content) {
        messageData.content = sanitizeContent(messageData.content);
      }

      // Verify chat room access
      return requireChatRoomAccess(
        () => messageData.chatRoomId,
        async (request, context) => {
          // Verify sender is the authenticated user
          if (messageData.senderId !== context.user.id) {
            return NextResponse.json(
              {
                error: "Cannot send message as another user",
                code: "INVALID_SENDER",
              },
              { status: 403 }
            );
          }

          const supabase = createSupabaseServerClient();

          // Check if chat room is active
          const { data: chatRoom, error: roomError } = await supabase
            .from("chat_rooms")
            .select("isActive")
            .eq("id", messageData.chatRoomId)
            .single();

          if (roomError || !chatRoom) {
            return NextResponse.json(
              {
                error: "Chat room not found",
                code: "CHAT_ROOM_NOT_FOUND",
              },
              { status: 404 }
            );
          }

          if (!chatRoom.isActive) {
            return NextResponse.json(
              {
                error: "Cannot send message to inactive chat room",
                code: "CHAT_ROOM_INACTIVE",
              },
              { status: 400 }
            );
          }

          // Insert message
          const { data: message, error } = await supabase
            .from("chat_messages")
            .insert({
              chatRoomId: messageData.chatRoomId,
              senderId: messageData.senderId,
              content: messageData.content,
              messageType: messageData.messageType,
              fileUrl: messageData.fileUrl,
              fileName: messageData.fileName,
              fileSize: messageData.fileSize,
              isRead: false,
            })
            .select(
              `
              *,
              sender:senderId (
                id,
                name,
                role
              )
            `
            )
            .single();

          if (error) {
            throw error;
          }

          // Update chat room's updatedAt timestamp
          await supabase
            .from("chat_rooms")
            .update({ updatedAt: new Date().toISOString() })
            .eq("id", messageData.chatRoomId);

          return NextResponse.json(message, { status: 201 });
        }
      )(request);
    } catch (error) {
      console.error("Error sending message:", error);

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
          error: "Failed to send message",
          code: "SEND_MESSAGE_ERROR",
        },
        { status: 500 }
      );
    }
  }
);
