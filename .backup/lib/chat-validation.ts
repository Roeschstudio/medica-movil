import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";
import { ValidationError } from "./validation";

// Enhanced content validation schemas
export const chatContentSchema = z
  .string()
  .min(1, "Message content cannot be empty")
  .max(5000, "Message content too long (max 5000 characters)")
  .refine(
    (content) => {
      // Check for excessive whitespace
      const trimmed = content.trim();
      return trimmed.length > 0;
    },
    {
      message: "Message cannot contain only whitespace",
    }
  )
  .refine(
    (content) => {
      // Check for spam patterns (repeated characters)
      const repeatedPattern = /(.)\1{10,}/;
      return !repeatedPattern.test(content);
    },
    {
      message: "Message contains excessive repeated characters",
    }
  )
  .refine(
    (content) => {
      // Check for excessive line breaks
      const lineBreaks = (content.match(/\n/g) || []).length;
      return lineBreaks <= 50;
    },
    {
      message: "Message contains too many line breaks",
    }
  );

// File validation schemas
export const chatFileSchema = z.object({
  fileName: z
    .string()
    .min(1, "File name is required")
    .max(255, "File name too long")
    .refine(
      (name) => {
        // Check for dangerous file extensions
        const dangerousExtensions = [
          ".exe",
          ".bat",
          ".cmd",
          ".com",
          ".pif",
          ".scr",
          ".vbs",
          ".js",
          ".jar",
          ".app",
          ".deb",
          ".pkg",
          ".dmg",
          ".msi",
          ".run",
        ];
        const extension = name.toLowerCase().substring(name.lastIndexOf("."));
        return !dangerousExtensions.includes(extension);
      },
      {
        message: "File type not allowed for security reasons",
      }
    )
    .refine(
      (name) => {
        // Check for path traversal attempts
        return (
          !name.includes("..") && !name.includes("/") && !name.includes("\\")
        );
      },
      {
        message: "Invalid file name format",
      }
    ),
  fileSize: z
    .number()
    .int("File size must be an integer")
    .positive("File size must be positive")
    .max(50 * 1024 * 1024, "File too large (max 50MB)"),
  fileType: z
    .string()
    .min(1, "File type is required")
    .refine(
      (type) => {
        const allowedTypes = [
          // Images
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/svg+xml",
          // Documents
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/plain",
          "text/csv",
          // Audio
          "audio/mpeg",
          "audio/wav",
          "audio/ogg",
          "audio/mp4",
          // Video
          "video/mp4",
          "video/quicktime",
          "video/webm",
          "video/avi",
        ];
        return allowedTypes.includes(type);
      },
      {
        message: "File type not allowed",
      }
    ),
});

// Enhanced message validation
export const enhancedChatMessageSchema = z
  .object({
    chatRoomId: z.string().uuid("Invalid chat room ID"),
    senderId: z.string().uuid("Invalid sender ID"),
    content: chatContentSchema.optional(),
    messageType: z
      .enum(["TEXT", "FILE", "IMAGE", "VIDEO", "AUDIO"], {
        errorMap: () => ({ message: "Invalid message type" }),
      })
      .default("TEXT"),
    fileUrl: z.string().url("Invalid file URL").optional(),
    fileName: z.string().max(255, "File name too long").optional(),
    fileSize: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024)
      .optional(),
    metadata: z.record(z.any()).optional(),
  })
  .refine(
    (data) => {
      // Either content or fileUrl must be provided
      return data.content || data.fileUrl;
    },
    {
      message: "Either message content or file must be provided",
      path: ["content"],
    }
  )
  .refine(
    (data) => {
      // If messageType is not TEXT, fileUrl must be provided
      if (data.messageType !== "TEXT" && !data.fileUrl) {
        return false;
      }
      return true;
    },
    {
      message: "File URL required for non-text messages",
      path: ["fileUrl"],
    }
  )
  .refine(
    (data) => {
      // Validate file data consistency
      if (data.fileUrl && (!data.fileName || !data.fileSize)) {
        return false;
      }
      return true;
    },
    {
      message: "File name and size required when file URL is provided",
      path: ["fileName"],
    }
  );

// Content sanitization with enhanced security
export class ChatContentSanitizer {
  private static readonly DANGEROUS_PATTERNS = [
    // Script injection patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<link\b[^<]*>/gi,
    /<meta\b[^<]*>/gi,
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,

    // Event handlers
    /on\w+\s*=/gi,

    // JavaScript protocols
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,

    // Form elements
    /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
    /<input\b[^<]*>/gi,
    /<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi,
    /<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi,
    /<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi,
  ];

  private static readonly SUSPICIOUS_PATTERNS = [
    // SQL injection attempts
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,

    // Path traversal
    /\.\.[\/\\]/g,

    // Command injection
    /[;&|`$(){}[\]]/g,

    // Excessive repetition (potential spam)
    /(.)\1{20,}/g,
  ];

  public static sanitizeContent(content: string): string {
    if (!content) return "";

    // First pass: Remove dangerous HTML/JS patterns
    let sanitized = content;

    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, "");
    }

    // Use DOMPurify for additional HTML sanitization
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ["b", "i", "u", "strong", "em", "br", "p"],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });

    // Remove suspicious patterns but don't fail completely
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        console.warn("Suspicious pattern detected in chat content:", pattern);
        // Log for security monitoring but don't block
      }
    }

    // Normalize whitespace
    sanitized = sanitized
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\n{3,}/g, "\n\n") // Limit consecutive line breaks
      .trim();

    return sanitized;
  }

  public static validateContent(content: string): {
    isValid: boolean;
    sanitized: string;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check for suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(`Suspicious pattern detected: ${pattern.source}`);
      }
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    const sanitized = this.sanitizeContent(content);
    const isValid = warnings.length === 0;

    return {
      isValid,
      sanitized,
      warnings,
    };
  }
}

// File security validation
export class ChatFileValidator {
  private static readonly MAGIC_NUMBERS: Record<string, string[]> = {
    "image/jpeg": ["FFD8FF"],
    "image/png": ["89504E47"],
    "image/gif": ["474946"],
    "application/pdf": ["255044462D"],
    "video/mp4": ["66747970"],
    "audio/mpeg": ["494433", "FFFB"],
  };

  private static readonly MAX_FILE_SIZES: Record<string, number> = {
    "image/*": 10 * 1024 * 1024, // 10MB
    "video/*": 100 * 1024 * 1024, // 100MB
    "audio/*": 50 * 1024 * 1024, // 50MB
    "application/*": 25 * 1024 * 1024, // 25MB
    "text/*": 1 * 1024 * 1024, // 1MB
  };

  public static validateFile(file: {
    name: string;
    size: number;
    type: string;
    buffer?: Buffer;
  }): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate file name
    if (!file.name || file.name.length === 0) {
      errors.push("File name is required");
    } else if (file.name.length > 255) {
      errors.push("File name too long");
    } else if (
      file.name.includes("..") ||
      file.name.includes("/") ||
      file.name.includes("\\")
    ) {
      errors.push("Invalid file name format");
    }

    // Validate file size
    if (!file.size || file.size <= 0) {
      errors.push("Invalid file size");
    } else {
      const maxSize = this.getMaxFileSize(file.type);
      if (file.size > maxSize) {
        errors.push(
          `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`
        );
      }
    }

    // Validate file type
    if (!file.type) {
      errors.push("File type is required");
    } else if (!this.isAllowedFileType(file.type)) {
      errors.push("File type not allowed");
    }

    // Validate file extension matches MIME type
    const extension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));
    if (!this.validateExtensionMimeMatch(extension, file.type)) {
      warnings.push("File extension does not match MIME type");
    }

    // Validate magic numbers if buffer is provided
    if (file.buffer && this.MAGIC_NUMBERS[file.type]) {
      if (!this.validateMagicNumbers(file.buffer, file.type)) {
        errors.push("File content does not match declared type");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static getMaxFileSize(mimeType: string): number {
    const category = mimeType.split("/")[0] + "/*";
    return (
      this.MAX_FILE_SIZES[category] || this.MAX_FILE_SIZES["application/*"]
    );
  }

  private static isAllowedFileType(mimeType: string): boolean {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "audio/mpeg",
      "audio/wav",
      "video/mp4",
      "video/quicktime",
    ];
    return allowedTypes.includes(mimeType);
  }

  private static validateExtensionMimeMatch(
    extension: string,
    mimeType: string
  ): boolean {
    const extensionMimeMap: Record<string, string[]> = {
      ".jpg": ["image/jpeg"],
      ".jpeg": ["image/jpeg"],
      ".png": ["image/png"],
      ".gif": ["image/gif"],
      ".webp": ["image/webp"],
      ".pdf": ["application/pdf"],
      ".doc": ["application/msword"],
      ".docx": [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      ".txt": ["text/plain"],
      ".mp3": ["audio/mpeg"],
      ".wav": ["audio/wav"],
      ".mp4": ["video/mp4"],
      ".mov": ["video/quicktime"],
    };

    const allowedMimes = extensionMimeMap[extension];
    return allowedMimes ? allowedMimes.includes(mimeType) : false;
  }

  private static validateMagicNumbers(
    buffer: Buffer,
    mimeType: string
  ): boolean {
    const magicNumbers = this.MAGIC_NUMBERS[mimeType];
    if (!magicNumbers) return true; // No magic numbers to check

    const fileHeader = buffer.toString("hex", 0, 8).toUpperCase();

    return magicNumbers.some((magic) => fileHeader.startsWith(magic));
  }
}

// Rate limiting validation
export const chatRateLimitSchema = z.object({
  userId: z.string().uuid(),
  chatRoomId: z.string().uuid(),
  action: z.enum(["send_message", "upload_file", "create_room"]),
  timestamp: z.number().int().positive(),
});

// Security audit logging
export interface SecurityAuditLog {
  userId: string;
  chatRoomId?: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, any>;
  severity: "low" | "medium" | "high" | "critical";
}

export class ChatSecurityAuditor {
  private static logs: SecurityAuditLog[] = [];

  public static logSecurityEvent(
    event: Omit<SecurityAuditLog, "timestamp">
  ): void {
    const log: SecurityAuditLog = {
      ...event,
      timestamp: new Date(),
    };

    this.logs.push(log);

    // In production, send to security monitoring service
    if (process.env.NODE_ENV === "production") {
      console.warn("Security Event:", log);
      // Send to security monitoring service
    }

    // Keep only last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  public static getSecurityLogs(filters?: {
    userId?: string;
    chatRoomId?: string;
    severity?: string;
    since?: Date;
  }): SecurityAuditLog[] {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.userId === filters.userId
        );
      }
      if (filters.chatRoomId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.chatRoomId === filters.chatRoomId
        );
      }
      if (filters.severity) {
        filteredLogs = filteredLogs.filter(
          (log) => log.severity === filters.severity
        );
      }
      if (filters.since) {
        filteredLogs = filteredLogs.filter(
          (log) => log.timestamp >= filters.since!
        );
      }
    }

    return filteredLogs.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }
}

// Validation middleware
export const validateChatMessage = (data: unknown) => {
  try {
    const validated = enhancedChatMessageSchema.parse(data);

    // Sanitize content if present
    if (validated.content) {
      const contentValidation = ChatContentSanitizer.validateContent(
        validated.content
      );

      if (!contentValidation.isValid) {
        throw new ValidationError(
          `Content validation failed: ${contentValidation.warnings.join(", ")}`,
          "content",
          "CONTENT_SECURITY_ERROR"
        );
      }

      validated.content = contentValidation.sanitized;
    }

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join("."),
        "VALIDATION_ERROR"
      );
    }
    throw error;
  }
};

export const validateChatFile = (file: {
  name: string;
  size: number;
  type: string;
  buffer?: Buffer;
}) => {
  const validation = ChatFileValidator.validateFile(file);

  if (!validation.isValid) {
    throw new ValidationError(
      validation.errors.join(", "),
      "file",
      "FILE_VALIDATION_ERROR"
    );
  }

  if (validation.warnings.length > 0) {
    console.warn("File validation warnings:", validation.warnings);
  }

  return validation;
};
