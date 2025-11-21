"use client";

import { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Check,
  CheckCheck,
  Download,
  Eye,
  File,
  Image as ImageIcon,
  Play,
  Volume2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showSender?: boolean;
  showTimestamp?: boolean;
  isGrouped?: boolean;
  onFileDownload?: (fileUrl: string, fileName: string) => void;
  onImagePreview?: (imageUrl: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  showSender = true,
  showTimestamp = true,
  isGrouped = false,
  onFileDownload,
  onImagePreview,
}: MessageBubbleProps) {
  const [imageError, setImageError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  const formatTime = (date: Date) => {
    return format(new Date(date), "HH:mm", { locale: es });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileDownload = () => {
    if (message.fileUrl && message.fileName && onFileDownload) {
      onFileDownload(message.fileUrl, message.fileName);
    }
  };

  const handleImagePreview = () => {
    if (message.fileUrl && onImagePreview) {
      onImagePreview(message.fileUrl);
    }
  };

  const renderFileContent = () => {
    if (!message.fileUrl) return null;

    switch (message.messageType) {
      case "IMAGE":
        return (
          <div className="relative max-w-xs">
            {!imageError ? (
              <div className="relative">
                <Image
                  src={message.fileUrl}
                  alt={message.fileName || "Imagen compartida"}
                  width={300}
                  height={200}
                  className={cn(
                    "rounded-lg cursor-pointer transition-opacity",
                    isImageLoading && "opacity-50"
                  )}
                  onLoad={() => setIsImageLoading(false)}
                  onError={() => {
                    setImageError(true);
                    setIsImageLoading(false);
                  }}
                  onClick={handleImagePreview}
                />
                {isImageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                  </div>
                )}
                <button
                  onClick={handleImagePreview}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <ImageIcon className="h-5 w-5 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {message.fileName || "Imagen"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {message.fileSize
                      ? formatFileSize(message.fileSize)
                      : "Tamaño desconocido"}
                  </p>
                </div>
                <button
                  onClick={handleFileDownload}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        );

      case "VIDEO":
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-xs">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                <Play className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {message.fileName || "Video"}
              </p>
              <p className="text-xs text-gray-500">
                {message.fileSize
                  ? formatFileSize(message.fileSize)
                  : "Tamaño desconocido"}
              </p>
            </div>
            <button
              onClick={handleFileDownload}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        );

      case "AUDIO":
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-xs">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <Volume2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {message.fileName || "Audio"}
              </p>
              <p className="text-xs text-gray-500">
                {message.fileSize
                  ? formatFileSize(message.fileSize)
                  : "Tamaño desconocido"}
              </p>
            </div>
            <button
              onClick={handleFileDownload}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        );

      case "FILE":
      default:
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-xs">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <File className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {message.fileName || "Archivo"}
              </p>
              <p className="text-xs text-gray-500">
                {message.fileSize
                  ? formatFileSize(message.fileSize)
                  : "Tamaño desconocido"}
              </p>
            </div>
            <button
              onClick={handleFileDownload}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        );
    }
  };

  const renderReadReceipt = () => {
    if (!isOwn) return null;

    return (
      <div className="flex items-center space-x-1 mt-1">
        {message.isRead ? (
          <CheckCheck className="h-3 w-3 text-blue-500" />
        ) : (
          <Check className="h-3 w-3 text-gray-400" />
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex w-full",
        isOwn ? "justify-end" : "justify-start",
        isGrouped ? "mt-1" : "mt-4"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] space-y-1",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {/* Sender name */}
        {showSender && !isOwn && !isGrouped && (
          <p className="text-xs text-gray-500 px-1">
            {(message.sender as any)?.name || "Usuario"}
          </p>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "px-3 py-2 rounded-2xl shadow-sm",
            isOwn
              ? "bg-blue-500 text-white rounded-br-md"
              : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md",
            isGrouped && isOwn && "rounded-br-2xl",
            isGrouped && !isOwn && "rounded-bl-2xl"
          )}
        >
          {/* File content */}
          {message.messageType !== "TEXT" && renderFileContent()}

          {/* Text content */}
          {message.content && (
            <p
              className={cn(
                "text-sm whitespace-pre-wrap break-words",
                message.messageType !== "TEXT" && "mt-2"
              )}
            >
              {message.content}
            </p>
          )}

          {/* Timestamp and read receipt */}
          <div
            className={cn(
              "flex items-center justify-between mt-1 space-x-2",
              isOwn ? "flex-row-reverse space-x-reverse" : "flex-row"
            )}
          >
            {showTimestamp && (
              <span
                className={cn(
                  "text-xs",
                  isOwn ? "text-blue-100" : "text-gray-500"
                )}
              >
                {formatTime(message.sentAt)}
              </span>
            )}
            {renderReadReceipt()}
          </div>
        </div>
      </div>
    </div>
  );
}
