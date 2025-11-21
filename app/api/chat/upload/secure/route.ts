import { requireChatRoomAccess } from "@/lib/chat-auth-middleware";
import {
  chatFileUploadRateLimiter,
  withChatRateLimit,
} from "@/lib/chat-rate-limiting";
import { ChatSecurityAuditor, validateChatFile } from "@/lib/chat-validation";
import {
  FileSecurityScanner,
  withFileSecurityScan,
} from "@/lib/file-security-scanner";
import { createSupabaseServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { ErrorLogger } from "@/lib/error-logger";

// POST /api/chat/upload/secure - Upload file with enhanced security scanning
export const POST = withChatRateLimit(chatFileUploadRateLimiter)(
  withFileSecurityScan(async (request: NextRequest, scanResult) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const chatRoomId = formData.get("chatRoomId") as string;
      const uploaderId = formData.get("uploaderId") as string;

      if (!file || !chatRoomId || !uploaderId) {
        return NextResponse.json(
          {
            error: "File, chat room ID, and uploader ID are required",
            code: "MISSING_REQUIRED_FIELDS",
          },
          { status: 400 }
        );
      }

      // Verify chat room access
      return requireChatRoomAccess(
        () => chatRoomId,
        async (request, context) => {
          // Verify uploader is the authenticated user
          if (uploaderId !== context.user.id) {
            ChatSecurityAuditor.logSecurityEvent({
              userId: context.user.id,
              chatRoomId,
              action: "invalid_uploader_attempt",
              ipAddress: request.headers.get("x-forwarded-for") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              details: {
                attemptedUploaderId: uploaderId,
                actualUserId: context.user.id,
                fileName: file.name,
              },
              severity: "high",
            });

            return NextResponse.json(
              {
                error: "Cannot upload file as another user",
                code: "INVALID_UPLOADER",
              },
              { status: 403 }
            );
          }

          // Check if chat room allows file uploads
          if (!context.chatRoom.isActive && context.userRole !== "admin") {
            return NextResponse.json(
              {
                error: "Cannot upload files to inactive chat room",
                code: "CHAT_ROOM_INACTIVE",
              },
              { status: 400 }
            );
          }

          // Validate file properties
          try {
            validateChatFile({
              name: file.name,
              size: file.size,
              type: file.type,
            });
          } catch (validationError) {
            ChatSecurityAuditor.logSecurityEvent({
              userId: context.user.id,
              chatRoomId,
              action: "file_validation_failed",
              ipAddress: request.headers.get("x-forwarded-for") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              details: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                validationError:
                  validationError instanceof Error
                    ? validationError.message
                    : "Unknown error",
              },
              severity: "medium",
            });

            return NextResponse.json(
              {
                error:
                  validationError instanceof Error
                    ? validationError.message
                    : "File validation failed",
                code: "FILE_VALIDATION_ERROR",
              },
              { status: 400 }
            );
          }

          // Check security scan results
          if (!scanResult.isClean) {
            const criticalThreats = scanResult.threats.filter(
              (t) => t.severity === "critical" || t.severity === "high"
            );

            if (criticalThreats.length > 0) {
              // Quarantine the file
              await FileSecurityScanner.quarantineFile(
                `quarantine/${scanResult.metadata.hash}`,
                scanResult,
                "Security threats detected"
              );

              ChatSecurityAuditor.logSecurityEvent({
                userId: context.user.id,
                chatRoomId,
                action: "malicious_file_blocked",
                ipAddress: request.headers.get("x-forwarded-for") || "unknown",
                userAgent: request.headers.get("user-agent") || "unknown",
                details: {
                  fileName: file.name,
                  fileHash: scanResult.metadata.hash,
                  threats: criticalThreats,
                  scanResult: scanResult,
                },
                severity: "critical",
              });

              return NextResponse.json(
                {
                  error: "File blocked due to security threats",
                  code: "FILE_SECURITY_THREAT",
                  threats: criticalThreats.map((t) => ({
                    type: t.type,
                    severity: t.severity,
                    description: t.description,
                  })),
                },
                { status: 400 }
              );
            }

            // Log warnings for medium/low severity threats
            if (scanResult.threats.length > 0) {
              ChatSecurityAuditor.logSecurityEvent({
                userId: context.user.id,
                chatRoomId,
                action: "file_security_warnings",
                ipAddress: request.headers.get("x-forwarded-for") || "unknown",
                userAgent: request.headers.get("user-agent") || "unknown",
                details: {
                  fileName: file.name,
                  fileHash: scanResult.metadata.hash,
                  threats: scanResult.threats,
                  warnings: scanResult.warnings,
                },
                severity: "medium",
              });
            }
          }

          const supabase = await createSupabaseServerClient();

          // Generate secure file path
          const timestamp = Date.now();
          const fileExtension = file.name.split(".").pop();
          const secureFileName = `${timestamp}-${scanResult.metadata.hash.substring(
            0,
            8
          )}.${fileExtension}`;
          const filePath = `chat-files/${chatRoomId}/${getFileCategory(
            file.type
          )}/${secureFileName}`;

          try {
            // Upload file to Supabase Storage
            const { data: uploadData, error: uploadError } =
              await supabase.storage.from("chat-files").upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
                metadata: {
                  originalName: file.name,
                  uploaderId: context.user.id,
                  chatRoomId: chatRoomId,
                  scanVersion: scanResult.metadata.scanVersion,
                  fileHash: scanResult.metadata.hash,
                  scannedAt: scanResult.metadata.uploadedAt.toISOString(),
                  threatsDetected: scanResult.threats.length.toString(),
                },
              });

            if (uploadError) {
              throw uploadError;
            }

            // Get public URL
            const {
              data: { publicUrl },
            } = supabase.storage
              .from("chat-files")
              .getPublicUrl(uploadData.path);

            // Log successful upload
            ChatSecurityAuditor.logSecurityEvent({
              userId: context.user.id,
              chatRoomId,
              action: "file_uploaded_success",
              ipAddress: request.headers.get("x-forwarded-for") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              details: {
                fileName: file.name,
                secureFileName,
                fileSize: file.size,
                fileType: file.type,
                fileHash: scanResult.metadata.hash,
                filePath: uploadData.path,
                publicUrl,
                scanClean: scanResult.isClean,
                threatsDetected: scanResult.threats.length,
              },
              severity: "low",
            });

            return NextResponse.json(
              {
                success: true,
                file: {
                  url: publicUrl,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  path: uploadData.path,
                },
                security: {
                  scanned: true,
                  clean: scanResult.isClean,
                  hash: scanResult.metadata.hash,
                  threats: scanResult.threats.length,
                  warnings: scanResult.warnings.length,
                  scanVersion: scanResult.metadata.scanVersion,
                },
              },
              { status: 201 }
            );
          } catch (uploadError) {
            ErrorLogger.log({
              error: uploadError,
              context: "File upload error",
              action: "POST /api/chat/upload/secure",
              level: "error",
              userId: context.user.id
            });

            ChatSecurityAuditor.logSecurityEvent({
              userId: context.user.id,
              chatRoomId,
              action: "file_upload_error",
              ipAddress: request.headers.get("x-forwarded-for") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              details: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                error:
                  uploadError instanceof Error
                    ? uploadError.message
                    : "Unknown error",
              },
              severity: "medium",
            });

            return NextResponse.json(
              {
                error: "Failed to upload file",
                code: "UPLOAD_ERROR",
                details:
                  uploadError instanceof Error
                    ? uploadError.message
                    : "Unknown error",
              },
              { status: 500 }
            );
          }
        }
      )(request);
    } catch (error) {
      ErrorLogger.log({
        error,
        context: "File upload processing error",
        action: "POST /api/chat/upload/secure",
        level: "error"
      });

      return NextResponse.json(
        {
          error: "Failed to process file upload",
          code: "UPLOAD_PROCESSING_ERROR",
        },
        { status: 500 }
      );
    }
  }),
  (_request) => ({
    chatRoomId: "extracted-from-form-data", // This would be extracted from form data
    user: { id: "extracted-from-auth" }, // This would be extracted from auth context
  })
);

// Helper function to categorize files
function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "images";
  if (mimeType.startsWith("video/")) return "videos";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  ) {
    return "documents";
  }
  return "other";
}

// GET /api/chat/upload/secure/stats - Get upload statistics (admin only)
export const GET = requireChatRoomAccess(
  () => "admin", // This would need proper admin verification
  async (request, context) => {
    if (context.userRole !== "admin") {
      return NextResponse.json(
        {
          error: "Admin access required",
          code: "ADMIN_ACCESS_REQUIRED",
        },
        { status: 403 }
      );
    }

    try {
      const url = new URL(request.url);
      const since = url.searchParams.get("since");
      const sinceDate = since
        ? new Date(since)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get scan statistics
      const scanStats = FileSecurityScanner.getScanStatistics(sinceDate);

      // Get security audit logs for file operations
      const securityLogs = ChatSecurityAuditor.getSecurityLogs({
        since: sinceDate,
      }).filter(
        (log) =>
          log.action.includes("file") ||
          log.action.includes("upload") ||
          log.action.includes("scan")
      );

      const uploadStats = {
        totalUploads: securityLogs.filter(
          (log) => log.action === "file_uploaded_success"
        ).length,
        blockedUploads: securityLogs.filter(
          (log) => log.action === "malicious_file_blocked"
        ).length,
        failedUploads: securityLogs.filter(
          (log) => log.action === "file_upload_error"
        ).length,
        quarantinedFiles: securityLogs.filter(
          (log) => log.action === "file_quarantined"
        ).length,
      };

      return NextResponse.json({
        period: {
          since: sinceDate.toISOString(),
          until: new Date().toISOString(),
        },
        scanning: scanStats,
        uploads: uploadStats,
        security: {
          totalSecurityEvents: securityLogs.length,
          criticalEvents: securityLogs.filter(
            (log) => log.severity === "critical"
          ).length,
          highSeverityEvents: securityLogs.filter(
            (log) => log.severity === "high"
          ).length,
        },
      });
    } catch (error) {
      ErrorLogger.log({
        error,
        context: "Error fetching upload stats",
        action: "GET /api/chat/upload/secure/stats",
        level: "error",
        userId: context.user.id
      });
      return NextResponse.json(
        {
          error: "Failed to fetch upload statistics",
          code: "STATS_ERROR",
        },
        { status: 500 }
      );
    }
  }
);
