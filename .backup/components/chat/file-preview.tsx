"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Download,
  File,
  FileText,
  Image as ImageIcon,
  Play,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  onDownload?: () => void;
}

export function FilePreview({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  onDownload,
}: FilePreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = () => {
    if (fileType.startsWith("image/")) return ImageIcon;
    if (fileType.startsWith("video/")) return Play;
    if (fileType.startsWith("audio/")) return Volume2;
    if (fileType === "application/pdf" || fileType.includes("text"))
      return FileText;
    return File;
  };

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const handleDownload = useCallback(async () => {
    if (onDownload) {
      onDownload();
    } else {
      try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error("Error downloading file:", error);
      }
    }
  }, [fileUrl, fileName, onDownload]);

  const renderPreviewContent = () => {
    // Image preview
    if (fileType.startsWith("image/")) {
      return (
        <div className="relative flex items-center justify-center min-h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          {!imageError ? (
            <div
              className="relative transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              <Image
                src={fileUrl}
                alt={fileName}
                width={800}
                height={600}
                className={cn(
                  "max-w-full max-h-[70vh] object-contain",
                  isLoading && "opacity-50"
                )}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setImageError(true);
                  setIsLoading(false);
                }}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <ImageIcon className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                No se pudo cargar la imagen
              </p>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Descargar archivo
              </Button>
            </div>
          )}

          {/* Zoom controls for images */}
          {!imageError && (
            <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-black/50 rounded-lg p-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomOut}
                disabled={zoom <= 0.25}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-white text-sm min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetZoom}
                className="h-8 px-2 text-white hover:bg-white/20"
              >
                Reset
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Video preview
    if (fileType.startsWith("video/")) {
      return (
        <div className="relative flex items-center justify-center min-h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg">
          <video
            controls
            className="max-w-full max-h-[70vh] rounded-lg"
            preload="metadata"
          >
            <source src={fileUrl} type={fileType} />
            Tu navegador no soporta la reproducción de video.
          </video>
        </div>
      );
    }

    // Audio preview
    if (fileType.startsWith("audio/")) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg p-8">
          <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6">
            <Volume2 className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <audio controls className="w-full max-w-md">
            <source src={fileUrl} type={fileType} />
            Tu navegador no soporta la reproducción de audio.
          </audio>
        </div>
      );
    }

    // PDF preview (using iframe)
    if (fileType === "application/pdf") {
      return (
        <div className="relative min-h-[600px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-[600px] border-0"
            title={fileName}
          />
        </div>
      );
    }

    // Text file preview
    if (fileType.startsWith("text/")) {
      return (
        <div className="min-h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="bg-white dark:bg-gray-900 rounded border p-4 h-full overflow-auto">
            <TextFilePreview fileUrl={fileUrl} />
          </div>
        </div>
      );
    }

    // Default preview for unsupported files
    const FileIcon = getFileIcon();
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
        <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-6">
          <FileIcon className="h-12 w-12 text-gray-600 dark:text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Vista previa no disponible
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Este tipo de archivo no se puede previsualizar en el navegador.
        </p>
        <Button onClick={handleDownload} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Descargar archivo
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="truncate">{fileName}</DialogTitle>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-500">{fileType}</span>
                {fileSize && (
                  <span className="text-sm text-gray-500">
                    {formatFileSize(fileSize)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-auto max-h-[calc(90vh-120px)]">
          {renderPreviewContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for text file preview
function TextFilePreview({ fileUrl }: { fileUrl: string }) {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    fetch(fileUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch file");
        return response.text();
      })
      .then((text) => {
        setContent(text);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-center">
        <div>
          <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Error al cargar el archivo</p>
        </div>
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 font-mono">
      {content}
    </pre>
  );
}
