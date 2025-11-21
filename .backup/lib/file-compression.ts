/**
 * File compression utilities for chat file uploads
 * Handles image compression and optimization before upload
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for JPEG quality
  format?: "jpeg" | "png" | "webp";
  maxSizeKB?: number; // Maximum file size in KB
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress an image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    format = "jpeg",
    maxSizeKB = 1024, // 1MB default
  } = options;

  return new Promise((resolve, reject) => {
    // Check if file is an image
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions
        const { width: newWidth, height: newHeight } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );

        // Set canvas dimensions
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw and compress image
        if (ctx) {
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"));
                return;
              }

              // Check if compression is needed
              const originalSize = file.size;
              const compressedSize = blob.size;

              // If compressed size is still too large, try with lower quality
              if (compressedSize > maxSizeKB * 1024 && quality > 0.1) {
                const newQuality = Math.max(0.1, quality - 0.1);
                compressImage(file, { ...options, quality: newQuality })
                  .then(resolve)
                  .catch(reject);
                return;
              }

              // Create new file
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, `.${format}`),
                {
                  type: `image/${format}`,
                  lastModified: Date.now(),
                }
              );

              resolve({
                file: compressedFile,
                originalSize,
                compressedSize,
                compressionRatio: originalSize / compressedSize,
              });
            },
            `image/${format}`,
            quality
          );
        } else {
          reject(new Error("Failed to get canvas context"));
        }
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    // Load image
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let { width, height } = { width: originalWidth, height: originalHeight };

  // Calculate scaling factor
  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const ratio = Math.min(widthRatio, heightRatio, 1); // Don't upscale

  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  return { width, height };
}

/**
 * Check if a file should be compressed
 */
export function shouldCompressFile(
  file: File,
  maxSizeKB: number = 1024
): boolean {
  // Only compress images
  if (!file.type.startsWith("image/")) {
    return false;
  }

  // Compress if file is larger than threshold
  return file.size > maxSizeKB * 1024;
}

/**
 * Get optimal compression settings based on file size
 */
export function getOptimalCompressionSettings(file: File): CompressionOptions {
  const sizeKB = file.size / 1024;

  if (sizeKB < 500) {
    // Small files - minimal compression
    return {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.9,
      maxSizeKB: 1024,
    };
  } else if (sizeKB < 2000) {
    // Medium files - moderate compression
    return {
      maxWidth: 1600,
      maxHeight: 900,
      quality: 0.8,
      maxSizeKB: 800,
    };
  } else if (sizeKB < 5000) {
    // Large files - aggressive compression
    return {
      maxWidth: 1280,
      maxHeight: 720,
      quality: 0.7,
      maxSizeKB: 600,
    };
  } else {
    // Very large files - maximum compression
    return {
      maxWidth: 1024,
      maxHeight: 576,
      quality: 0.6,
      maxSizeKB: 400,
    };
  }
}

/**
 * Compress file with automatic settings
 */
export async function autoCompressFile(file: File): Promise<File> {
  // Only compress images
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // Check if compression is needed
  if (!shouldCompressFile(file)) {
    return file;
  }

  try {
    const settings = getOptimalCompressionSettings(file);
    const result = await compressImage(file, settings);

    console.log(
      `Image compressed: ${(result.originalSize / 1024).toFixed(1)}KB → ${(
        result.compressedSize / 1024
      ).toFixed(1)}KB (${(result.compressionRatio * 100).toFixed(
        1
      )}% reduction)`
    );

    return result.file;
  } catch (error) {
    console.warn("Failed to compress image, using original:", error);
    return file;
  }
}

/**
 * Validate file before upload
 */
export interface FileValidationOptions {
  maxSizeKB?: number;
  allowedTypes?: string[];
  maxDimensions?: { width: number; height: number };
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export async function validateFile(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const {
    maxSizeKB = 10 * 1024, // 10MB default
    allowedTypes = [
      "image/*",
      "application/pdf",
      "text/*",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  } = options;

  const warnings: string[] = [];

  // Check file size
  if (file.size > maxSizeKB * 1024) {
    return {
      isValid: false,
      error: `El archivo es demasiado grande. Máximo ${maxSizeKB / 1024}MB`,
    };
  }

  // Check file type
  const isAllowed = allowedTypes.some((allowedType) => {
    if (allowedType.endsWith("/*")) {
      const category = allowedType.replace("/*", "");
      return file.type.startsWith(category);
    }
    return file.type === allowedType;
  });

  if (!isAllowed) {
    return {
      isValid: false,
      error: `Tipo de archivo no permitido: ${file.type}`,
    };
  }

  // Check if image needs compression
  if (file.type.startsWith("image/") && shouldCompressFile(file, 1024)) {
    warnings.push("La imagen será comprimida para optimizar la subida");
  }

  // Validate image dimensions (if applicable)
  if (file.type.startsWith("image/") && options.maxDimensions) {
    try {
      const dimensions = await getImageDimensions(file);
      if (
        dimensions.width > options.maxDimensions.width ||
        dimensions.height > options.maxDimensions.height
      ) {
        warnings.push(
          `La imagen será redimensionada (${dimensions.width}x${dimensions.height} → máx ${options.maxDimensions.width}x${options.maxDimensions.height})`
        );
      }
    } catch (error) {
      console.warn("Failed to get image dimensions:", error);
    }
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Get image dimensions
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      reject(new Error("Failed to load image"));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get file type category
 */
export function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("document") || mimeType.includes("text"))
    return "document";
  return "file";
}

/**
 * Generate thumbnail for image files
 */
export async function generateThumbnail(
  file: File,
  size: number = 150
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      const { width, height } = calculateDimensions(
        img.width,
        img.height,
        size,
        size
      );

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } else {
        reject(new Error("Failed to get canvas context"));
      }

      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
  });
}
