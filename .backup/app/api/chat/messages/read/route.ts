import { requireChatRoomAccess } from "@/lib/auth-middleware";
import { apiRateLimiter, withRateLimit } from "@/lib/rate-limiting";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  markMessagesReadSchema,
  validateRequestBody,
  ValidationError,
} from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/chat/messages/read - Mark messages as read
export const PUT = withRateLimit(apiRateLimiter)(async (
  request: NextRequest
) => {
  try {
    const readData = await validateRequestBody(request, markMessagesReadSchema);

    return requireChatRoomAccess(
      () => readData.chatRoomId,
      async (request, context) => {
        const supabase = createSupabaseServerClient();

        // Build update query
        let query = supabase
          .from("chat_messages")
          .update({ isRead: true })
          .eq("chatRoomId", readData.chatRoomId)
          .neq("senderId", context.user.id); // Don't mark own messages as read

        // If specific message IDs provided, filter by them
        if (readData.messageIds && readData.messageIds.length > 0) {
          query = query.in("id", readData.messageIds);
        } else {
          // Otherwise, mark all unread messages as read
          query = query.eq("isRead", false);
        }

        const { error, count } = await query;

        if (error) {
          throw error;
        }

        return NextResponse.json({
          success: true,
          markedAsRead: count || 0,
        });
      }
    )(request);
  } catch (error) {
    console.error("Error marking messages as read:", error);

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
        error: "Failed to mark messages as read",
        code: "MARK_READ_ERROR",
      },
      { status: 500 }
    );
  }
});
