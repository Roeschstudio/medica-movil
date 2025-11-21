"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Check,
  File,
  Image as ImageIcon,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileUpload: (file: File) => Promise<boolean>;
  onCancel?: () => void;
  disabled?: boolean;
  maxFileSize?: number; // in bytes
  allowedFileTypes?: string[];
  multiple?: boolean;
  className?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}

export function FileUpload({
  onFileSelect,
  onFileUpload,
  onCancel,
  disabled = false,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedFileTypes = [
    "image/*",
    "application/pdf",
    "text/*",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  multiple = false,
  className,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Validate file
  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      if (file.size > maxFileSize) {
        return `El archivo "${
          file.name
        }" es demasiado grande. Máximo ${formatFileSize(maxFileSize)}`;
      }

      // Check file type
      const isAllowed = allowedFileTypes.some((allowedType) => {
        if (allowedType.endsWith("/*")) {
          const category = allowedType.replace("/*", "");
          return file.type.startsWith(category);
        }
        return file.type === allowedType;
      });

      if (!isAllowed) {
        return `Tipo de archivo "${file.type}" no permitido`;
      }

      return null;
    },
    [maxFileSize, allowedFileTypes]
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList) => {
      setError(null);
      const fileArray = Array.from(files);

      // Validate files
      for (const file of fileArray) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      // Process files
      const filesToUpload = fileArray.map((file) => ({
        file,
        progress: 0,
        status: "uploading" as const,
      }));

      setUploadingFiles(filesToUpload);

      // Start uploads
      filesToUpload.forEach((uploadingFile, index) => {
        uploadFile(uploadingFile, index);
      });

      // Notify parent of first file selection
      if (fileArray.length > 0) {
        onFileSelect(fileArray[0]);
      }
    },
    [validateFile, onFileSelect]
  );

  // Upload file with progress simulation
  const uploadFile = useCallback(
    async (uploadingFile: UploadingFile, index: number) => {
      try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadingFiles((prev) => {
            const updated = [...prev];
            if (updated[index] && updated[index].progress < 90) {
              updated[index] = {
                ...updated[index],
                progress: updated[index].progress + Math.random() * 20,
              };
            }
            return updated;
          });
        }, 200);

        // Perform actual upload
        const success = await onFileUpload(uploadingFile.file);

        clearInterval(progressInterval);

        // Update final status
        setUploadingFiles((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              progress: 100,
              status: success ? "completed" : "error",
              error: success ? undefined : "Error al subir el archivo",
            };
          }
          return updated;
        });

        // Auto-remove completed files after delay
        if (success) {
          setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
          }, 2000);
        }
      } catch (error) {
        console.error("Upload error:", error);
        setUploadingFiles((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              status: "error",
              error:
                error instanceof Error ? error.message : "Error desconocido",
            };
          }
          return updated;
        });
      }
    },
    [onFileUpload]
  );

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files);
      }
    },
    [handleFileSelect]
  );

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFileSelect(files);
      }
    },
    [handleFileSelect]
  );

  // Remove uploading file
  const removeUploadingFile = useCallback((index: number) => {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Retry upload
  const retryUpload = useCallback(
    (index: number) => {
      const uploadingFile = uploadingFiles[index];
      if (uploadingFile) {
        setUploadingFiles((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            progress: 0,
            status: "uploading",
            error: undefined,
          };
          return updated;
        });
        uploadFile(uploadingFile, index);
      }
    },
    [uploadingFiles, uploadFile]
  );

  // Get file icon
  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return ImageIcon;
    return File;
  };

  // Get status color
  const getStatusColor = (status: UploadingFile["status"]) => {
    switch (status) {
      case "uploading":
        return "text-blue-500";
      case "completed":
        return "text-green-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Upload area */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedFileTypes.join(",")}
          onChange={handleFileInputChange}
          multiple={multiple}
          disabled={disabled}
          className="hidden"
        />

        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Upload className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {dragActive
                ? "Suelta los archivos aquí"
                : "Arrastra archivos aquí o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-gray-500">
              Máximo {formatFileSize(maxFileSize)} por archivo
            </p>
            <p className="text-xs text-gray-500">
              Tipos permitidos: {allowedFileTypes.join(", ")}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="mt-4"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Seleccionar archivos
          </Button>
        </div>
      </div>

      {/* Uploading files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Subiendo archivos
          </h4>

          {uploadingFiles.map((uploadingFile, index) => {
            const FileIcon = getFileIcon(uploadingFile.file);
            const statusColor = getStatusColor(uploadingFile.status);

            return (
              <div
                key={`${uploadingFile.file.name}-${index}`}
                className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    {uploadingFile.status === "completed" ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <FileIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {uploadingFile.file.name}
                    </p>
                    <span className={cn("text-xs font-medium", statusColor)}>
                      {uploadingFile.status === "uploading" &&
                        `${Math.round(uploadingFile.progress)}%`}
                      {uploadingFile.status === "completed" && "Completado"}
                      {uploadingFile.status === "error" && "Error"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadingFile.file.size)}
                    </p>

                    {uploadingFile.status === "uploading" && (
                      <Progress
                        value={uploadingFile.progress}
                        className="w-24 h-2"
                      />
                    )}
                  </div>

                  {uploadingFile.error && (
                    <p className="text-xs text-red-500 mt-1">
                      {uploadingFile.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  {uploadingFile.status === "error" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => retryUpload(index)}
                      className="h-8 w-8 p-0"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeUploadingFile(index)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel button */}
      {onCancel && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
