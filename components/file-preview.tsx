"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Download,
  ExternalLink,
  Eye,
  File,
  FileText,
  Image as ImageIcon,
  Music,
  RotateCw,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useState } from "react";

interface FilePreviewProps {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
  thumbnailUrl?: string;
  className?: string;
  showDownload?: boolean;
  showPreview?: boolean;
}

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={handleRotate}>
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={handleReset}>
          Reset
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-w-full max-h-full overflow-auto p-4">
        <img
          src={src}
          alt={alt}
          className="max-w-none transition-transform duration-200"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: "center",
          }}
          onClick={onClose}
        />
      </div>
    </div>
  );
};

const FilePreview: React.FC<FilePreviewProps> = ({
  fileName,
  fileUrl,
  fileSize,
  fileType = "",
  thumbnailUrl,
  className,
  showDownload = true,
  showPreview = true,
}) => {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = () => {
    if (fileType.startsWith("image/")) return <ImageIcon className="h-6 w-6" />;
    if (fileType.startsWith("video/")) return <Video className="h-6 w-6" />;
    if (fileType.startsWith("audio/")) return <Music className="h-6 w-6" />;
    if (fileType.includes("pdf")) return <FileText className="h-6 w-6" />;
    return <File className="h-6 w-6" />;
  };

  const getFileTypeLabel = () => {
    if (fileType.startsWith("image/")) return "Imagen";
    if (fileType.startsWith("video/")) return "Video";
    if (fileType.startsWith("audio/")) return "Audio";
    if (fileType.includes("pdf")) return "PDF";
    if (fileType.includes("word")) return "Word";
    if (fileType.includes("text")) return "Texto";
    return "Archivo";
  };

  const canPreviewInline = () => {
    return (
      fileType.startsWith("image/") ||
      fileType.includes("pdf") ||
      fileType.startsWith("text/")
    );
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = () => {
    if (fileType.startsWith("image/")) {
      setShowImageViewer(true);
    } else {
      window.open(fileUrl, "_blank");
    }
  };

  const renderPreviewContent = () => {
    if (previewError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <File className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No se puede mostrar la vista previa
          </p>
        </div>
      );
    }

    if (fileType.startsWith("image/")) {
      return (
        <div className="relative">
          <img
            src={thumbnailUrl || fileUrl}
            alt={fileName}
            className="max-w-full max-h-96 object-contain rounded"
            onError={() => setPreviewError(true)}
          />
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => setShowImageViewer(true)}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    if (fileType.includes("pdf")) {
      return (
        <div className="w-full h-96">
          <iframe
            src={`${fileUrl}#toolbar=0`}
            className="w-full h-full border rounded"
            title={fileName}
            onError={() => setPreviewError(true)}
          />
        </div>
      );
    }

    if (fileType.startsWith("text/")) {
      return (
        <div className="w-full h-64 overflow-auto">
          <iframe
            src={fileUrl}
            className="w-full h-full border rounded"
            title={fileName}
            onError={() => setPreviewError(true)}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        {getFileIcon()}
        <p className="text-sm text-muted-foreground mt-2">
          Vista previa no disponible para este tipo de archivo
        </p>
      </div>
    );
  };

  return (
    <>
      <div className={cn("border rounded-lg p-4 bg-card", className)}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-muted-foreground">
            {fileType.startsWith("image/") && (thumbnailUrl || fileUrl) ? (
              <img
                src={thumbnailUrl || fileUrl}
                alt={fileName}
                className="h-12 w-12 object-cover rounded border"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove(
                    "hidden"
                  );
                }}
              />
            ) : null}
            <div
              className={cn(
                "flex items-center justify-center h-12 w-12 rounded border bg-muted",
                fileType.startsWith("image/") &&
                  (thumbnailUrl || fileUrl) &&
                  "hidden"
              )}
            >
              {getFileIcon()}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">{fileName}</h4>
              <Badge variant="outline" className="text-xs">
                {getFileTypeLabel()}
              </Badge>
            </div>

            {fileSize && (
              <p className="text-xs text-muted-foreground mb-2">
                {formatFileSize(fileSize)}
              </p>
            )}

            <div className="flex items-center gap-2">
              {showPreview && canPreviewInline() && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-7">
                      <Eye className="h-3 w-3 mr-1" />
                      Vista previa
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle className="truncate">{fileName}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">{renderPreviewContent()}</div>
                  </DialogContent>
                </Dialog>
              )}

              {showPreview && fileType.startsWith("image/") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreview}
                  className="text-xs h-7"
                >
                  <ZoomIn className="h-3 w-3 mr-1" />
                  Ampliar
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(fileUrl, "_blank")}
                className="text-xs h-7"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir
              </Button>

              {showDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="text-xs h-7"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Descargar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showImageViewer && fileType.startsWith("image/") && (
        <ImageViewer
          src={fileUrl}
          alt={fileName}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </>
  );
};

export default FilePreview;
