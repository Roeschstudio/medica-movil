import { requireAuth } from "@/lib/auth-middleware";
import { userFileUploadRateLimiter, withRateLimit } from "@/lib/rate-limiting";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  fileUploadSchema,
  getFileCategory,
  validateFileType,
  ValidationError,
} from "@/lib/validation";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
];

// POST /api/upload - Upload a file
export const POST = withRateLimit(userFileUploadRateLimiter)(
  requireAuth(async (request, context) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const chatRoomId = formData.get("chatRoomId") as string;

      if (!file) {
        return NextResponse.json(
          {
            error: "No file provided",
            code: "NO_FILE",
          },
          { status: 400 }
        );
      }

      // Validate file data
      const fileData = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        chatRoomId: chatRoomId || undefined,
      };

      try {
        fileUploadSchema.parse(fileData);
      } catch (error: any) {
        throw new ValidationError(
          error.errors[0]?.message || "Invalid file data"
        );
      }

      // Validate file type
      if (!validateFileType(file.type, ALLOWED_FILE_TYPES)) {
        return NextResponse.json(
          {
            error: "File type not allowed",
            code: "INVALID_FILE_TYPE",
            allowedTypes: ALLOWED_FILE_TYPES,
          },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File too large. Maximum size is ${
              MAX_FILE_SIZE / (1024 * 1024)
            }MB`,
            code: "FILE_TOO_LARGE",
            maxSize: MAX_FILE_SIZE,
          },
          { status: 400 }
        );
      }

      // If chatRoomId provided, verify access
      if (chatRoomId) {
        const supabase = createSupabaseServerClient();
        const { data: chatRoom, error } = await supabase
          .from("chat_rooms")
          .select("patientId, doctorId")
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

        // Check if user has access to this chat room
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
      }

      // Generate unique file name
      const fileExtension = file.name.split(".").pop();
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const uniqueFileName = `${timestamp}-${randomString}.${fileExtension}`;

      // Determine storage path based on file category
      const fileCategory = getFileCategory(file.type);
      const storagePath = chatRoomId
        ? `chat-files/${chatRoomId}/${uniqueFileName}`
        : `uploads/${fileCategory}/${uniqueFileName}`;

      const supabase = createSupabaseServerClient();

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("medical-files")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return NextResponse.json(
          {
            error: "Failed to upload file",
            code: "UPLOAD_FAILED",
            details: uploadError.message,
          },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("medical-files")
        .getPublicUrl(storagePath);

      let thumbnailUrl: string | undefined;

      // Generate thumbnail for images
      if (file.type.startsWith("image/")) {
        try {
          const { data: thumbnailData } = supabase.storage
            .from("medical-files")
            .getPublicUrl(storagePath, {
              transform: {
                width: 200,
                height: 200,
                resize: "cover",
              },
            });
          thumbnailUrl = thumbnailData.publicUrl;
        } catch (error) {
          console.warn("Could not generate thumbnail:", error);
        }
      }

      // Create file record in database
      const { data: fileRecord, error: dbError } = await supabase
        .from("medical_files")
        .insert({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl: urlData.publicUrl,
          uploadedBy: context.user.id,
          visibility: "PRIVATE",
          category: fileCategory.toUpperCase(),
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        // Try to cleanup uploaded file
        await supabase.storage.from("medical-files").remove([storagePath]);

        return NextResponse.json(
          {
            error: "Failed to save file record",
            code: "DB_ERROR",
          },
          { status: 500 }
        );
      }

      const response = {
        id: fileRecord.id,
        name: file.name,
        size: file.size,
        type: file.type,
        url: urlData.publicUrl,
        thumbnailUrl,
        category: fileCategory,
        uploadedAt: fileRecord.createdAt,
      };

      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      console.error("Error uploading file:", error);

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
          error: "Failed to upload file",
          code: "UPLOAD_ERROR",
        },
        { status: 500 }
      );
    }
  })
);
