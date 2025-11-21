"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  File,
  FileText,
  Image as ImageIcon,
  Music,
  Upload,
  Video,
  X,
} from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

interface FileUploadProps {
  onFileUpload: (file: UploadedFile) => void;
  onError?: (error: string) => void;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnailUrl?: string;
}

interface FileUploadState {
  file: File;
  id: string;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
  uploadedFile?: UploadedFile;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  onError,
  maxFileSize = 10, // 10MB default
  allowedTypes = [
    "image/*",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "video/mp4",
    "video/quicktime",
    "audio/mpeg",
    "audio/wav",
  ],
  multiple = false,
  disabled = false,
  className,
}) => {
  const [uploadStates, setUploadStates] = useState<FileUploadState[]>([]);
  const supabase = createSupabaseBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error handling
  const { handleError, retryOperation } = useFileUploadErrorHandler();

  // Offline-aware upload operation
  const { executeOperation: uploadFileOfflineAware } = useOfflineAwareOperation(
    uploadFileToSupabase,
    {
      showOfflineMessage: true,
    }
  );

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <ImageIcon className="h-8 w-8" />;
    if (fileType.startsWith("video/")) return <Video className="h-8 w-8" />;
    if (fileType.startsWith("audio/")) return <Music className="h-8 w-8" />;
    if (fileType.includes("pdf")) return <FileText className="h-8 w-8" />;
    return <File className="h-8 w-8" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return `El archivo es demasiado grande. Máximo ${maxFileSize}MB permitido.`;
    }

    // Check file type
    const isAllowed = allowedTypes.some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return "Tipo de archivo no permitido.";
    }

    return null;
  };

  const uploadFileToSupabase = async (file: File): Promise<UploadedFile> => {
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileExtension = file.name.split(".").pop();
    const fileName = `${fileId}.${fileExtension}`;
    const filePath = `chat-files/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from("medical-files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(`Error uploading file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("medical-files")
      .getPublicUrl(filePath);

    let thumbnailUrl: string | undefined;

    // Generate thumbnail for images
    if (file.type.startsWith("image/")) {
      try {
        const { data: thumbnailData } = supabase.storage
          .from("medical-files")
          .getPublicUrl(filePath, {
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

    return {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: urlData.publicUrl,
      thumbnailUrl,
    };
  };

  const handleFileUpload = async (files: File[]) => {
    if (disabled) return;

    const newUploadStates: FileUploadState[] = files.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      progress: 0,
      status: "uploading" as const,
    }));

    setUploadStates((prev) => [...prev, ...newUploadStates]);

    for (const uploadState of newUploadStates) {
      try {
        // Validate file
        const validationError = validateFile(uploadState.file);
        if (validationError) {
          setUploadStates((prev) =>
            prev.map((state) =>
              state.id === uploadState.id
                ? { ...state, status: "error", error: validationError }
                : state
            )
          );
          onError?.(validationError);
          continue;
        }

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadStates((prev) =>
            prev.map((state) =>
              state.id === uploadState.id && state.progress < 90
                ? { ...state, progress: state.progress + 10 }
                : state
            )
          );
        }, 200);

        // Upload file with retry logic
        const uploadedFile = await retryOperation(
          () => uploadFileOfflineAware(uploadState.file),
          { maxAttempts: 3, delay: 2000 }
        );

        if (!uploadedFile) {
          throw new Error("Upload failed after retries");
        }

        clearInterval(progressInterval);

        // Update state to completed
        setUploadStates((prev) =>
          prev.map((state) =>
            state.id === uploadState.id
              ? {
                  ...state,
                  status: "completed",
                  progress: 100,
                  uploadedFile,
                }
              : state
          )
        );

        // Notify parent component
        onFileUpload(uploadedFile);
      } catch (error) {
        const handledError = handleError(error, {
          action: "file_upload",
          metadata: { fileName: uploadState.file.name },
        });

        setUploadStates((prev) =>
          prev.map((state) =>
            state.id === uploadState.id
              ? { ...state, status: "error", error: handledError.message }
              : state
          )
        );

        onError?.(handledError);
      }
    }
  };

  const removeUploadState = (id: string) => {
    setUploadStates((prev) => prev.filter((state) => state.id !== id));
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      handleFileUpload(acceptedFiles);
    },
    [disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    disabled,
    accept: allowedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: maxFileSize * 1024 * 1024,
  });

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files);
    }
    // Reset input
    e.target.value = "";
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <Card
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragActive && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <Upload
            className={cn(
              "h-12 w-12 mb-4 text-muted-foreground",
              isDragActive && "text-primary"
            )}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {isDragActive
                ? "Suelta los archivos aquí"
                : "Arrastra archivos aquí o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-muted-foreground">
              Máximo {maxFileSize}MB por archivo
            </p>
            <p className="text-xs text-muted-foreground">
              Tipos permitidos: Imágenes, PDF, Word, Video, Audio
            </p>
          </div>

          <input {...getInputProps()} />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleButtonClick}
            disabled={disabled}
          >
            Seleccionar archivos
          </Button>
        </CardContent>
      </Card>

      {/* Hidden file input for button click */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={allowedTypes.join(",")}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Upload Progress */}
      {uploadStates.length > 0 && (
        <div className="space-y-2">
          {uploadStates.map((uploadState) => (
            <Card key={uploadState.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 text-muted-foreground">
                  {getFileIcon(uploadState.file.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">
                      {uploadState.file.name}
                    </p>
                    <div className="flex items-center gap-2">
                      {uploadState.status === "uploading" && (
                        <Badge variant="secondary" className="text-xs">
                          Subiendo...
                        </Badge>
                      )}
                      {uploadState.status === "completed" && (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completado
                        </Badge>
                      )}
                      {uploadState.status === "error" && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUploadState(uploadState.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{formatFileSize(uploadState.file.size)}</span>
                    {uploadState.status === "uploading" && (
                      <span>{uploadState.progress}%</span>
                    )}
                  </div>

                  {uploadState.status === "uploading" && (
                    <Progress value={uploadState.progress} className="h-2" />
                  )}

                  {uploadState.status === "error" && uploadState.error && (
                    <p className="text-xs text-destructive mt-1">
                      {uploadState.error}
                    </p>
                  )}

                  {uploadState.status === "completed" &&
                    uploadState.uploadedFile && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(uploadState.uploadedFile!.url, "_blank")
                          }
                          className="text-xs h-7"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = uploadState.uploadedFile!.url;
                            link.download = uploadState.uploadedFile!.name;
                            link.click();
                          }}
                          className="text-xs h-7"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Descargar
                        </Button>
                      </div>
                    )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
