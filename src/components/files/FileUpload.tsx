'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Upload, 
  File, 
  FileText, 
  Image, 
  X, 
  Check,
  AlertCircle,
  Download,
  Eye
} from 'lucide-react';

interface FileUploadProps {
  appointmentId?: string;
  patientId?: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
  allowedTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  fileType: 'STUDY' | 'PRESCRIPTION' | 'DOCUMENT' | 'IMAGE' | 'PDF';
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  appointmentId,
  patientId,
  onUploadComplete,
  allowedTypes = ['image/*', 'application/pdf', '.doc', '.docx'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing files
  React.useEffect(() => {
    const loadFiles = async () => {
      if (!appointmentId && !patientId) return;
      
      try {
        const params = new URLSearchParams();
        if (appointmentId) params.append('appointmentId', appointmentId);
        if (patientId) params.append('patientId', patientId);
        
        const response = await fetch(`/api/files/upload?${params}`);
        if (response.ok) {
          const data = await response.json();
          setUploadedFiles(data.files || []);
        }
      } catch (_error) {
      toast.error('Error al cargar los archivos');
    }
    };

     loadFiles();
  }, [appointmentId, patientId]);

  // File type detection
  const getFileType = (file: File): 'STUDY' | 'PRESCRIPTION' | 'DOCUMENT' | 'IMAGE' | 'PDF' => {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    if (mimeType.startsWith('image/')) {
      return 'IMAGE';
    }
    
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return 'PDF';
    }
    
    if (fileName.includes('prescription') || fileName.includes('receta')) {
      return 'PRESCRIPTION';
    }
    
    if (fileName.includes('study') || fileName.includes('estudio') || 
        fileName.includes('lab') || fileName.includes('laboratorio')) {
      return 'STUDY';
    }
    
    return 'DOCUMENT';
  };

  // File icon
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="h-5 w-5" alt="Image file icon" />;
    }
    
    if (type === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    
    return <File className="h-5 w-5" />;
  };

  // Upload file
  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', getFileType(file));
    
    if (appointmentId) {
      formData.append('appointmentId', appointmentId);
    }
    
    if (patientId) {
      formData.append('patientId', patientId);
    }

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();
      return result.file;
    } catch (error) {
      throw error;
    }
  }, [appointmentId, patientId]);

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (uploadedFiles.length + acceptedFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file sizes
    const oversizedFiles = acceptedFiles.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      toast.error(`Files too large. Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }

    // Initialize uploading files
    const newUploadingFiles: UploadingFile[] = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading'
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
    setIsLoading(true);

    // Upload files in parallel
    const uploadPromises = acceptedFiles.map(async (file) => {
      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map(uf => 
              uf.file === file && uf.progress < 90
                ? { ...uf, progress: uf.progress + 10 }
                : uf
            )
          );
        }, 200);

        const uploadedFile = await uploadFile(file);
        
        clearInterval(progressInterval);
        
        // Mark as completed
        setUploadingFiles(prev => 
          prev.map(uf => 
            uf.file === file
              ? { ...uf, progress: 100, status: 'completed' }
              : uf
          )
        );
        
        // Add to uploaded files
        setUploadedFiles(prev => [...prev, uploadedFile]);
        
        toast.success(`${file.name} uploaded successfully`);
        return uploadedFile;
        
      } catch (error) {
        toast.error('Error al subir el archivo');
        
        setUploadingFiles(prev => 
          prev.map(uf => 
            uf.file === file
              ? { 
                  ...uf, 
                  status: 'error', 
                  error: error instanceof Error ? error.message : 'Upload failed'
                }
              : uf
          )
        );
        
        toast.error(`Failed to upload ${file.name}`);
        return null;
      }
    });
    
    await Promise.allSettled(uploadPromises);
    
    setIsLoading(false);
    
    // Remove completed uploads after delay
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(uf => uf.status !== 'completed'));
    }, 2000);
    
    // Notify parent
    if (onUploadComplete) {
      onUploadComplete(uploadedFiles);
    }
  }, [uploadedFiles, maxFiles, maxFileSize, onUploadComplete, uploadFile]);

  // Remove uploading file
  const removeUploadingFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(uf => uf.file !== file));
  };

  // Delete uploaded file
  const deleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
        toast.success('File deleted successfully');
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (_error) {
      toast.error('Error al eliminar el archivo');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxFileSize,
    disabled: isLoading
  });

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload Medical Files</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            
            {isDragActive ? (
              <p className="text-blue-600">Drop files here...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Supported: Images, PDF, DOC, DOCX (max {Math.round(maxFileSize / 1024 / 1024)}MB each)
                </p>
                <p className="text-sm text-gray-500">
                  Maximum {maxFiles} files
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploading Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadingFiles.map((uploadingFile, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  {getFileIcon(uploadingFile.file.type)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadingFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadingFile.file.size)}
                    </p>
                    
                    {uploadingFile.status === 'uploading' && (
                      <Progress value={uploadingFile.progress} className="mt-2" />
                    )}
                    
                    {uploadingFile.status === 'error' && (
                      <p className="text-xs text-red-500 mt-1">
                        {uploadingFile.error}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {uploadingFile.status === 'uploading' && (
                      <span className="text-xs text-blue-600">
                        {uploadingFile.progress}%
                      </span>
                    )}
                    
                    {uploadingFile.status === 'completed' && (
                      <Check className="h-5 w-5 text-green-500" />
                    )}
                    
                    {uploadingFile.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUploadingFile(uploadingFile.file)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files ({uploadedFiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  {getFileIcon(file.type)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {file.fileType}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = file.url;
                        link.download = file.name;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFile(file.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FileUpload;
export type { UploadedFile };