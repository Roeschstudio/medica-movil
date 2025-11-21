import { z } from "zod";

// Base validation schemas
export const idSchema = z.string().uuid("Invalid ID format");
export const emailSchema = z.string().email("Invalid email format");
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number");

// User validation schemas
export const userRoleSchema = z.enum(["ADMIN", "DOCTOR", "PATIENT"], {
  errorMap: () => ({ message: "Invalid user role" }),
});

// Chat validation schemas
export const messageTypeSchema = z.enum(
  ["TEXT", "FILE", "IMAGE", "VIDEO", "AUDIO"],
  {
    errorMap: () => ({ message: "Invalid message type" }),
  }
);

export const chatMessageSchema = z
  .object({
    chatRoomId: idSchema,
    senderId: idSchema,
    content: z.string().max(5000, "Message too long").optional(),
    messageType: messageTypeSchema.default("TEXT"),
    fileUrl: z.string().url("Invalid file URL").optional(),
    fileName: z.string().max(255, "File name too long").optional(),
    fileSize: z
      .number()
      .int()
      .positive("Invalid file size")
      .max(50 * 1024 * 1024, "File too large")
      .optional(),
  })
  .refine(
    (data) => {
      // Either content or fileUrl must be provided
      return data.content || data.fileUrl;
    },
    {
      message: "Either content or file must be provided",
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
  );

export const createChatRoomSchema = z.object({
  appointmentId: idSchema,
  patientId: idSchema,
  doctorId: idSchema,
});

export const markMessagesReadSchema = z.object({
  chatRoomId: idSchema,
  messageIds: z.array(idSchema).optional(),
});

// File upload validation schemas
export const fileUploadSchema = z.object({
  fileName: z
    .string()
    .min(1, "File name required")
    .max(255, "File name too long"),
  fileSize: z
    .number()
    .int()
    .positive("Invalid file size")
    .max(50 * 1024 * 1024, "File too large"),
  fileType: z.string().min(1, "File type required"),
  chatRoomId: idSchema.optional(),
});

// Notification validation schemas
export const notificationTypeSchema = z.enum(
  ["EMAIL", "SMS", "WHATSAPP", "PUSH"],
  {
    errorMap: () => ({ message: "Invalid notification type" }),
  }
);

export const createNotificationSchema = z.object({
  userId: idSchema,
  title: z.string().min(1, "Title required").max(255, "Title too long"),
  message: z.string().min(1, "Message required").max(1000, "Message too long"),
  type: notificationTypeSchema,
  data: z.record(z.any()).optional(),
});

// Video session validation schemas
export const createVideoSessionSchema = z.object({
  chatRoomId: idSchema,
  initiatorId: idSchema,
  sessionType: z
    .enum(["CONSULTATION", "FOLLOW_UP", "EMERGENCY"])
    .default("CONSULTATION"),
});

// Pagination validation schemas
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100, "Limit too high").default(20),
  cursor: z.string().optional(),
});

// Query parameter validation schemas
export const chatMessagesQuerySchema = z
  .object({
    chatRoomId: idSchema,
    messageType: messageTypeSchema.optional(),
    senderId: idSchema.optional(),
    isRead: z.boolean().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .merge(paginationSchema);

export const chatRoomsQuerySchema = z
  .object({
    userId: idSchema,
    includeInactive: z.boolean().default(false),
    appointmentId: idSchema.optional(),
  })
  .merge(paginationSchema);

// Content sanitization
export const sanitizeContent = (content: string): string => {
  // Remove potentially dangerous HTML tags and scripts
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    .replace(/<link\b[^<]*>/gi, "")
    .replace(/<meta\b[^<]*>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
};

// File type validation
export const ALLOWED_FILE_TYPES = {
  images: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
  videos: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
};

export const ALL_ALLOWED_FILE_TYPES = [
  ...ALLOWED_FILE_TYPES.images,
  ...ALLOWED_FILE_TYPES.documents,
  ...ALLOWED_FILE_TYPES.videos,
  ...ALLOWED_FILE_TYPES.audio,
];

export const validateFileType = (
  fileType: string,
  allowedTypes?: string[]
): boolean => {
  const allowed = allowedTypes || ALL_ALLOWED_FILE_TYPES;
  return allowed.includes(fileType);
};

export const getFileCategory = (fileType: string): string => {
  if (ALLOWED_FILE_TYPES.images.includes(fileType)) return "image";
  if (ALLOWED_FILE_TYPES.documents.includes(fileType)) return "document";
  if (ALLOWED_FILE_TYPES.videos.includes(fileType)) return "video";
  if (ALLOWED_FILE_TYPES.audio.includes(fileType)) return "audio";
  return "unknown";
};

// Validation error handling
export class ValidationError extends Error {
  public readonly field?: string;
  public readonly code: string;

  constructor(
    message: string,
    field?: string,
    code: string = "VALIDATION_ERROR"
  ) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.code = code;
  }
}

export const handleValidationError = (error: z.ZodError): ValidationError => {
  const firstError = error.errors[0];
  const field = firstError.path.join(".");
  const message = firstError.message;

  return new ValidationError(message, field, "VALIDATION_ERROR");
};

// Validation middleware helper
export const validateSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw handleValidationError(error);
    }
    throw error;
  }
};

// Request body validation
export const validateRequestBody = async <T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> => {
  try {
    const body = await request.json();
    return validateSchema(schema, body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError("Invalid JSON format", "body", "INVALID_JSON");
    }
    throw error;
  }
};

// Query parameters validation
export const validateQueryParams = <T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T => {
  const params: Record<string, any> = {};

  for (const [key, value] of searchParams.entries()) {
    // Handle boolean values
    if (value === "true") {
      params[key] = true;
    } else if (value === "false") {
      params[key] = false;
    } else if (!isNaN(Number(value)) && value !== "") {
      // Handle numeric values
      params[key] = Number(value);
    } else {
      params[key] = value;
    }
  }

  return validateSchema(schema, params);
};
