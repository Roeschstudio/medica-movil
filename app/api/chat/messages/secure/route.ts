import { requireChatRoomAccess } from "@/lib/chat-auth-middleware";
import {
  chatMessageRateLimiter,
  withChatRateLimit,
} from "@/lib/chat-rate-limiting";
import {
  ChatContentSanitizer,
  ChatSecurityAuditor,
  validateChatMessage,
} from "@/lib/chat-validation";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  chatMessagesQuerySchema,
  validateQueryParams,
  ValidationError,
} from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { ErrorLogger } from "@/lib/error-logger";

// GET /api/chat/messages/secure - Get messages for a chat room with enhanced security
export const GET = withChatRateLimit(chatMessageRateLimiter)(
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

        const supabase = await createSupabaseServerClient();

        // Log message access
        ChatSecurityAuditor.logSecurityEvent({
          userId: context.user.id,
          chatRoomId: context.chatRoom.id,
          action: "messages_accessed",
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
          details: {
            userRole: context.userRole,
            messageType: queryParams.messageType,
            page: queryParams.page,
            limit: queryParams.limit,
          },
          severity: "low",
        });

        // Build query with enhanced security
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
          `,
            { count: "exact" }
          )
          .eq("chatRoomId", queryParams.chatRoomId)
          .order("sentAt", { ascending: false });

        // Apply filters
        if (queryParams.messageType) {
          query = query.eq("messageType", queryParams.messageType);
        }
        if (queryParams.senderId) {
          // Verify user can access messages from this sender
          if (
            queryParams.senderId !== context.user.id &&
            context.userRole !== "admin"
          ) {
            // Only allow viewing own messages or all messages for admins
            const allowedSenders = [
              context.chatRoom.patientId,
              context.chatRoom.doctorId,
            ];
            if (!allowedSenders.includes(queryParams.senderId)) {
              return NextResponse.json(
                {
                  error: "Cannot access messages from this sender",
                  code: "SENDER_ACCESS_DENIED",
                },
                { status: 403 }
              );
            }
          }
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

        // Apply pagination with limits
        const maxLimit = context.userRole === "admin" ? 100 : 50;
        const safeLimit = Math.min(queryParams.limit, maxLimit);
        const offset = (queryParams.page - 1) * safeLimit;
        query = query.range(offset, offset + safeLimit - 1);

        const { data: messages, error, count } = await query;

        if (error) {
          ChatSecurityAuditor.logSecurityEvent({
            userId: context.user.id,
            chatRoomId: context.chatRoom.id,
            action: "message_fetch_error",
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
            details: {
              error: error.message,
              queryParams,
            },
            severity: "medium",
          });
          throw error;
        }

        // Sanitize message content for display
        const sanitizedMessages = (messages || []).map((message) => ({
          ...message,
          content: message.content
            ? ChatContentSanitizer.sanitizeContent(message.content)
            : null,
        }));

        return NextResponse.json({
          messages: sanitizedMessages.reverse(), // Reverse to show oldest first
          pagination: {
            page: queryParams.page,
            limit: safeLimit,
            total: count || 0,
            hasMore: (count || 0) > offset + safeLimit,
          },
          security: {
            contentSanitized: true,
            accessLogged: true,
          },
        });
      } catch (error) {
        ErrorLogger.log({
          error,
          context: "Error fetching messages",
          action: "GET /api/chat/messages/secure",
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
            error: "Failed to fetch messages",
            code: "FETCH_MESSAGES_ERROR",
          },
          { status: 500 }
        );
      }
    }
  ),
  (request) => ({
    chatRoomId: new URL(request.url).searchParams.get("chatRoomId"),
    user: { id: "extracted-from-auth" }, // This would be extracted from auth context
  })
);

// POST /api/chat/messages/secure - Send a new message with enhanced security
export const POST = withChatRateLimit(chatMessageRateLimiter)(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const messageData = validateChatMessage(body);

      // Verify chat room access
      return requireChatRoomAccess(
        () => messageData.chatRoomId,
        async (request, context) => {
          // Verify sender is the authenticated user
          if (messageData.senderId !== context.user.id) {
            ChatSecurityAuditor.logSecurityEvent({
              userId: context.user.id,
              chatRoomId: messageData.chatRoomId,
              action: "invalid_sender_attempt",
              ipAddress: request.headers.get("x-forwarded-for") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              details: {
                attemptedSenderId: messageData.senderId,
                actualUserId: context.user.id,
              },
              severity: "high",
            });

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
          if (!context.chatRoom.isActive && context.userRole !== "admin") {
            ChatSecurityAuditor.logSecurityEvent({
              userId: context.user.id,
              chatRoomId: messageData.chatRoomId,
              action: "inactive_room_message_attempt",
              ipAddress: request.headers.get("x-forwarded-for") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              details: {
                userRole: context.userRole,
                roomActive: context.chatRoom.isActive,
              },
              severity: "medium",
            });

            return NextResponse.json(
              {
                error: "Cannot send message to inactive chat room",
                code: "CHAT_ROOM_INACTIVE",
              },
              { status: 400 }
            );
          }

          // Enhanced content validation and sanitization
          if (messageData.content) {
            const contentValidation = ChatContentSanitizer.validateContent(
              messageData.content
            );

            if (!contentValidation.isValid) {
              ChatSecurityAuditor.logSecurityEvent({
                userId: context.user.id,
                chatRoomId: messageData.chatRoomId,
                action: "malicious_content_blocked",
                ipAddress: request.headers.get("x-forwarded-for") || "unknown",
                userAgent: request.headers.get("user-agent") || "unknown",
                details: {
                  warnings: contentValidation.warnings,
                  originalContentLength: messageData.content.length,
                },
                severity: "high",
              });

              return NextResponse.json(
                {
                  error: "Message content contains security violations",
                  code: "CONTENT_SECURITY_VIOLATION",
                  warnings: contentValidation.warnings,
                },
                { status: 400 }
              );
            }

            if (contentValidation.warnings.length > 0) {
              ChatSecurityAuditor.logSecurityEvent({
                userId: context.user.id,
                chatRoomId: messageData.chatRoomId,
                action: "suspicious_message_content",
                ipAddress: request.headers.get("x-forwarded-for") || "unknown",
                userAgent: request.headers.get("user-agent") || "unknown",
                details: {
                  warnings: contentValidation.warnings,
                  originalContent: messageData.content.substring(0, 100),
                },
                severity: "medium",
              });
            }

            messageData.content = contentValidation.sanitized;
          }

          // Validate file data if present
          if (messageData.fileUrl) {
            // Additional file validation could be added here
            if (!messageData.fileName || !messageData.fileSize) {
              return NextResponse.json(
                {
                  error: "File name and size are required for file messages",
                  code: "INCOMPLETE_FILE_DATA",
                },
                { status: 400 }
              );
            }

            // Log file message
            ChatSecurityAuditor.logSecurityEvent({
              userId: context.user.id,
              chatRoomId: messageData.chatRoomId,
              action: "file_message_sent",
              ipAddress: request.headers.get("x-forwarded-for") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              details: {
                fileName: messageData.fileName,
                fileSize: messageData.fileSize,
                messageType: messageData.messageType,
              },
              severity: "low",
            });
          }

          // Insert message with enhanced error handling
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
            ChatSecurityAuditor.logSecurityEvent({
              userId: context.user.id,
              chatRoomId: messageData.chatRoomId,
              action: "message_insert_error",
              ipAddress: request.headers.get("x-forwarded-for") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              details: {
                error: error.message,
                messageType: messageData.messageType,
                hasContent: !!messageData.content,
                hasFile: !!messageData.fileUrl,
              },
              severity: "medium",
            });
            throw error;
          }

          // Update chat room's updatedAt timestamp
          await supabase
            .from("chat_rooms")
            .update({ updatedAt: new Date().toISOString() })
            .eq("id", messageData.chatRoomId);

          // Log successful message send
          ChatSecurityAuditor.logSecurityEvent({
            userId: context.user.id,
            chatRoomId: messageData.chatRoomId,
            action: "message_sent_success",
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
            details: {
              messageId: message.id,
              messageType: messageData.messageType,
              hasFile: !!messageData.fileUrl,
              contentLength: messageData.content?.length || 0,
            },
            severity: "low",
          });

          return NextResponse.json(
            {
              ...message,
              security: {
                contentSanitized: !!messageData.content,
                validated: true,
                logged: true,
              },
            },
            { status: 201 }
          );
        }
      )(request);
    } catch (error) {
      ErrorLogger.log({
        error,
        context: "Error sending message",
        action: "POST /api/chat/messages/secure",
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
          error: "Failed to send message",
          code: "SEND_MESSAGE_ERROR",
        },
        { status: 500 }
      );
    }
  },
  (request) => ({
    chatRoomId:
      new URL(request.url).searchParams.get("chatRoomId") || "unknown",
    user: { id: "extracted-from-auth" }, // This would be extracted from auth context
  })
);
