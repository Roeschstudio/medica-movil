"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Paperclip, Send, Smile, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => Promise<boolean>;
  onFileUpload: (file: File) => Promise<boolean>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  showEmojiPicker?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  className?: string;
}

export function MessageInput({
  value,
  onChange,
  onSend,
  onFileUpload,
  disabled = false,
  placeholder = "Escribe un mensaje...",
  maxLength = 5000,
  allowedFileTypes = [
    "image/*",
    "application/pdf",
    "text/*",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  showEmojiPicker = true,
  onTypingStart,
  onTypingStop,
  className,
}: MessageInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle typing indicators
  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      setError(null);

      // Handle typing indicators
      if (newValue.trim() && onTypingStart) {
        onTypingStart();

        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to stop typing
        typingTimeoutRef.current = setTimeout(() => {
          onTypingStop?.();
        }, 1000);
      } else if (!newValue.trim() && onTypingStop) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        onTypingStop();
      }
    },
    [onChange, onTypingStart, onTypingStop]
  );

  // Handle message send
  const handleSend = useCallback(async () => {
    if (!value.trim() || disabled) return;

    try {
      const success = await onSend(value.trim());
      if (success) {
        // Stop typing when message is sent
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        onTypingStop?.();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Error al enviar el mensaje");
    }
  }, [value, disabled, onSend, onTypingStop]);

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Validate file with enhanced validation
  const validateFileEnhanced = useCallback(
    async (
      file: File
    ): Promise<{ isValid: boolean; error?: string; warnings?: string[] }> => {
      try {
        const result = await validateFile(file, {
          maxSizeKB: maxFileSize / 1024,
          allowedTypes: allowedFileTypes,
        });
        return result;
      } catch (error) {
        return {
          isValid: false,
          error: error instanceof Error ? error.message : "Error de validación",
        };
      }
    },
    [maxFileSize, allowedFileTypes]
  );

  // Handle file selection with compression
  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);

      try {
        // Validate file first
        const validation = await validateFileEnhanced(file);
        if (!validation.isValid) {
          setError(validation.error || "Archivo no válido");
          return;
        }

        // Show warnings if any
        if (validation.warnings && validation.warnings.length > 0) {
          console.log("File warnings:", validation.warnings);
        }

        // Compress file if it's an image
        const processedFile = await autoCompressFile(file);

        setSelectedFile(processedFile);
        setError(null);
      } catch (error) {
        console.error("Error processing file:", error);
        setError("Error al procesar el archivo");
      }
    },
    [validateFileEnhanced]
  );

  // Handle file upload
  const handleFileUpload = useCallback(async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      const success = await onFileUpload(selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (success) {
        setSelectedFile(null);
        setUploadProgress(0);
      } else {
        setError("Error al subir el archivo");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Error al subir el archivo");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFile, isUploading, onFileUpload]);

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
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

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  // Cancel file selection
  const handleCancelFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* File preview */}
      {selectedFile && (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <Paperclip className="h-4 w-4 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isUploading ? (
              <div className="flex items-center space-x-2">
                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{uploadProgress}%</span>
              </div>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleFileUpload}
                  disabled={disabled}
                  className="h-8 px-3"
                >
                  Enviar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelFile}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div
        className={cn(
          "flex items-end space-x-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors",
          dragActive && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
          disabled && "opacity-50"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedFileTypes.join(",")}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {/* File upload button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading || !!selectedFile}
          className="h-9 w-9 p-0 flex-shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Text input */}
        <div className="flex-1">
          <Input
            ref={textInputRef}
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || isUploading}
            maxLength={maxLength}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
          />
        </div>

        {/* Emoji picker button */}
        {showEmojiPicker && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isUploading}
            className="h-9 w-9 p-0 flex-shrink-0"
          >
            <Smile className="h-4 w-4" />
          </Button>
        )}

        {/* Send button */}
        <Button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim() || isUploading}
          className="h-9 w-9 p-0 flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Character count */}
      {maxLength && value.length > maxLength * 0.8 && (
        <div className="flex justify-end">
          <span
            className={cn(
              "text-xs",
              value.length > maxLength ? "text-red-500" : "text-gray-500"
            )}
          >
            {value.length}/{maxLength}
          </span>
        </div>
      )}

      {/* Drag and drop overlay */}
      {dragActive && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Paperclip className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Suelta el archivo aquí
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
