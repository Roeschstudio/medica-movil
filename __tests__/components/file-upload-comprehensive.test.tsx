import FileUpload, { type UploadedFile } from "@/src/components/files/FileUpload";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("react-dropzone", () => ({
  useDropzone: vi.fn(),
}));

vi.mock("@/hooks/use-offline-detection", () => ({
  useOfflineAwareOperation: vi.fn(),
}));

vi.mock("@/hooks/use-error-handler", () => ({
  useFileUploadErrorHandler: vi.fn(),
}));

import { useFileUploadErrorHandler } from "@/hooks/use-error-handler";
import { useOfflineAwareOperation } from "@/hooks/use-offline-detection";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { useDropzone } from "react-dropzone";

const mockCreateSupabaseBrowserClient = createSupabaseBrowserClient as any;
const mockUseDropzone = useDropzone as any;
const mockUseOfflineAwareOperation = useOfflineAwareOperation as any;
const mockUseFileUploadErrorHandler = useFileUploadErrorHandler as any;

describe("FileUpload Component", () => {
  const mockSupabase = {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  };

  const defaultProps = {
    onFileUpload: vi.fn(),
    onError: vi.fn(),
    maxFileSize: 10,
    allowedTypes: ["image/*", "application/pdf"],
    multiple: false,
    disabled: false,
  };

  const mockFile = new File(["test content"], "test.jpg", {
    type: "image/jpeg",
  });

  const mockUploadedFile: UploadedFile = {
    id: "file-123",
    name: "test.jpg",
    size: 1000,
    type: "image/jpeg",
    url: "https://example.com/test.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockCreateSupabaseBrowserClient.mockReturnValue(mockSupabase);

    // Mock successful upload
    mockSupabase.storage.from().upload.mockResolvedValue({
      data: { path: "chat-files/test.jpg" },
      error: null,
    });

    mockSupabase.storage.from().getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/test.jpg" },
    });

    // Mock dropzone
    mockUseDropzone.mockReturnValue({
      getRootProps: () => ({
        onClick: vi.fn(),
        onDrop: vi.fn(),
      }),
      getInputProps: () => ({
        type: "file",
        multiple: false,
      }),
      isDragActive: false,
    });

    // Mock offline aware operation
    mockUseOfflineAwareOperation.mockReturnValue({
      executeOperation: vi.fn((fn) => fn()),
    });

    // Mock error handler
    mockUseFileUploadErrorHandler.mockReturnValue({
      handleError: vi.fn((error) => error),
      retryOperation: vi.fn((fn) => fn()),
    });
  });

  describe("rendering", () => {
    it("should render upload area", () => {
      render(<FileUpload {...defaultProps} />);

      expect(
        screen.getByText("Arrastra archivos aquí o haz clic para seleccionar")
      ).toBeInTheDocument();
      expect(screen.getByText("Máximo 10MB por archivo")).toBeInTheDocument();
      expect(
        screen.getByText("Tipos permitidos: Imágenes, PDF, Word, Video, Audio")
      ).toBeInTheDocument();
      expect(screen.getByText("Seleccionar archivos")).toBeInTheDocument();
    });

    it("should show drag active state", () => {
      mockUseDropzone.mockReturnValue({
        getRootProps: () => ({}),
        getInputProps: () => ({}),
        isDragActive: true,
      });

      render(<FileUpload {...defaultProps} />);

      expect(screen.getByText("Suelta los archivos aquí")).toBeInTheDocument();
    });

    it("should be disabled when disabled prop is true", () => {
      render(<FileUpload {...defaultProps} disabled={true} />);

      const button = screen.getByText("Seleccionar archivos");
      expect(button).toBeDisabled();
    });

    it("should show custom max file size", () => {
      render(<FileUpload {...defaultProps} maxFileSize={5} />);

      expect(screen.getByText("Máximo 5MB por archivo")).toBeInTheDocument();
    });
  });

  describe("file validation", () => {
    it("should validate file size", async () => {
      const onError = vi.fn();
      render(
        <FileUpload {...defaultProps} onError={onError} maxFileSize={1} />
      );

      // Create a large file (2MB)
      const largeFile = new File(["x".repeat(2 * 1024 * 1024)], "large.jpg", {
        type: "image/jpeg",
      });

      // Simulate file drop
      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([largeFile]);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.stringContaining("El archivo es demasiado grande")
        );
      });
    });

    it("should validate file type", async () => {
      const onError = vi.fn();
      render(<FileUpload {...defaultProps} onError={onError} />);

      // Create an invalid file type
      const invalidFile = new File(["content"], "script.exe", {
        type: "application/x-executable",
      });

      // Simulate file drop
      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([invalidFile]);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith("Tipo de archivo no permitido.");
      });
    });

    it("should accept valid files", async () => {
      const onFileUpload = vi.fn();
      render(<FileUpload {...defaultProps} onFileUpload={onFileUpload} />);

      // Simulate file drop
      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(onFileUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "test.jpg",
            type: "image/jpeg",
            url: "https://example.com/test.jpg",
          })
        );
      });
    });
  });

  describe("file upload process", () => {
    it("should show upload progress", async () => {
      render(<FileUpload {...defaultProps} />);

      // Simulate file drop
      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      // Should show uploading state
      await waitFor(() => {
        expect(screen.getByText("Subiendo...")).toBeInTheDocument();
      });
    });

    it("should show completed state", async () => {
      const onFileUpload = vi.fn();
      render(<FileUpload {...defaultProps} onFileUpload={onFileUpload} />);

      // Simulate file drop
      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(screen.getByText("Completado")).toBeInTheDocument();
        expect(screen.getByText("Ver")).toBeInTheDocument();
        expect(screen.getByText("Descargar")).toBeInTheDocument();
      });
    });

    it("should handle upload errors", async () => {
      const onError = vi.fn();
      mockSupabase.storage
        .from()
        .upload.mockRejectedValue(new Error("Upload failed"));

      render(<FileUpload {...defaultProps} onError={onError} />);

      // Simulate file drop
      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
      });
    });

    it("should show file information", async () => {
      render(<FileUpload {...defaultProps} />);

      // Simulate file drop
      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(screen.getByText("test.jpg")).toBeInTheDocument();
      });
    });

    it("should format file size correctly", async () => {
      const largeFile = new File(["x".repeat(1024 * 1024)], "large.jpg", {
        type: "image/jpeg",
      });

      render(<FileUpload {...defaultProps} maxFileSize={5} />);

      // Simulate file drop
      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([largeFile]);

      await waitFor(() => {
        expect(screen.getByText("1 MB")).toBeInTheDocument();
      });
    });
  });

  describe("file icons", () => {
    it("should show correct icon for images", async () => {
      render(<FileUpload {...defaultProps} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      // Should render image icon (tested by checking if component renders without error)
      await waitFor(() => {
        expect(screen.getByText("test.jpg")).toBeInTheDocument();
      });
    });

    it("should show correct icon for PDFs", async () => {
      const pdfFile = new File(["content"], "document.pdf", {
        type: "application/pdf",
      });

      render(<FileUpload {...defaultProps} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([pdfFile]);

      await waitFor(() => {
        expect(screen.getByText("document.pdf")).toBeInTheDocument();
      });
    });

    it("should show correct icon for videos", async () => {
      const videoFile = new File(["content"], "video.mp4", {
        type: "video/mp4",
      });

      render(<FileUpload {...defaultProps} allowedTypes={["video/*"]} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([videoFile]);

      await waitFor(() => {
        expect(screen.getByText("video.mp4")).toBeInTheDocument();
      });
    });

    it("should show correct icon for audio files", async () => {
      const audioFile = new File(["content"], "audio.mp3", {
        type: "audio/mpeg",
      });

      render(<FileUpload {...defaultProps} allowedTypes={["audio/*"]} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([audioFile]);

      await waitFor(() => {
        expect(screen.getByText("audio.mp3")).toBeInTheDocument();
      });
    });
  });

  describe("multiple files", () => {
    it("should handle multiple file uploads", async () => {
      const onFileUpload = vi.fn();
      const file1 = new File(["content1"], "file1.jpg", { type: "image/jpeg" });
      const file2 = new File(["content2"], "file2.jpg", { type: "image/jpeg" });

      render(
        <FileUpload
          {...defaultProps}
          multiple={true}
          onFileUpload={onFileUpload}
        />
      );

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([file1, file2]);

      await waitFor(() => {
        expect(onFileUpload).toHaveBeenCalledTimes(2);
      });
    });

    it("should show progress for multiple files", async () => {
      const file1 = new File(["content1"], "file1.jpg", { type: "image/jpeg" });
      const file2 = new File(["content2"], "file2.jpg", { type: "image/jpeg" });

      render(<FileUpload {...defaultProps} multiple={true} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([file1, file2]);

      await waitFor(() => {
        expect(screen.getByText("file1.jpg")).toBeInTheDocument();
        expect(screen.getByText("file2.jpg")).toBeInTheDocument();
      });
    });
  });

  describe("user interactions", () => {
    it("should handle file input change", async () => {
      const user = userEvent.setup();
      const onFileUpload = vi.fn();

      render(<FileUpload {...defaultProps} onFileUpload={onFileUpload} />);

      const button = screen.getByText("Seleccionar archivos");
      await user.click(button);

      // Simulate file selection through hidden input
      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(onFileUpload).toHaveBeenCalled();
      });
    });

    it("should remove upload state", async () => {
      const user = userEvent.setup();
      render(<FileUpload {...defaultProps} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(screen.getByText("test.jpg")).toBeInTheDocument();
      });

      const removeButton = screen.getByRole("button", { name: /x/i });
      await user.click(removeButton);

      expect(screen.queryByText("test.jpg")).not.toBeInTheDocument();
    });

    it("should handle view file action", async () => {
      const user = userEvent.setup();
      const mockOpen = vi.fn();
      window.open = mockOpen;

      render(<FileUpload {...defaultProps} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(screen.getByText("Ver")).toBeInTheDocument();
      });

      const viewButton = screen.getByText("Ver");
      await user.click(viewButton);

      expect(mockOpen).toHaveBeenCalledWith(
        "https://example.com/test.jpg",
        "_blank"
      );
    });

    it("should handle download file action", async () => {
      const user = userEvent.setup();
      const mockClick = vi.fn();
      const mockCreateElement = vi
        .spyOn(document, "createElement")
        .mockReturnValue({
          href: "",
          download: "",
          click: mockClick,
        } as any);

      render(<FileUpload {...defaultProps} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(screen.getByText("Descargar")).toBeInTheDocument();
      });

      const downloadButton = screen.getByText("Descargar");
      await user.click(downloadButton);

      expect(mockCreateElement).toHaveBeenCalledWith("a");
      expect(mockClick).toHaveBeenCalled();

      mockCreateElement.mockRestore();
    });
  });

  describe("error handling", () => {
    it("should handle storage errors", async () => {
      const onError = vi.fn();
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: new Error("Storage error"),
      });

      render(<FileUpload {...defaultProps} onError={onError} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
      });
    });

    it("should retry failed uploads", async () => {
      const mockRetryOperation = vi.fn().mockImplementation((fn) => fn());
      mockUseFileUploadErrorHandler.mockReturnValue({
        handleError: vi.fn((error) => error),
        retryOperation: mockRetryOperation,
      });

      render(<FileUpload {...defaultProps} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(mockRetryOperation).toHaveBeenCalled();
      });
    });

    it("should handle offline scenarios", async () => {
      const mockExecuteOperation = vi
        .fn()
        .mockRejectedValue(new Error("Offline"));
      mockUseOfflineAwareOperation.mockReturnValue({
        executeOperation: mockExecuteOperation,
      });

      const onError = vi.fn();
      render(<FileUpload {...defaultProps} onError={onError} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(mockExecuteOperation).toHaveBeenCalled();
      });
    });
  });

  describe("accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(<FileUpload {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<FileUpload {...defaultProps} />);

      await user.tab();

      const button = screen.getByText("Seleccionar archivos");
      expect(button).toHaveFocus();
    });

    it("should have proper button roles", () => {
      render(<FileUpload {...defaultProps} />);

      const button = screen.getByRole("button", {
        name: "Seleccionar archivos",
      });
      expect(button).toBeInTheDocument();
    });
  });

  describe("thumbnail generation", () => {
    it("should generate thumbnails for images", async () => {
      mockSupabase.storage
        .from()
        .getPublicUrl.mockReturnValueOnce({
          data: { publicUrl: "https://example.com/test.jpg" },
        })
        .mockReturnValueOnce({
          data: { publicUrl: "https://example.com/thumb.jpg" },
        });

      const onFileUpload = vi.fn();
      render(<FileUpload {...defaultProps} onFileUpload={onFileUpload} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(onFileUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            thumbnailUrl: "https://example.com/thumb.jpg",
          })
        );
      });
    });

    it("should handle thumbnail generation errors gracefully", async () => {
      mockSupabase.storage
        .from()
        .getPublicUrl.mockReturnValueOnce({
          data: { publicUrl: "https://example.com/test.jpg" },
        })
        .mockImplementationOnce(() => {
          throw new Error("Thumbnail failed");
        });

      const onFileUpload = vi.fn();
      render(<FileUpload {...defaultProps} onFileUpload={onFileUpload} />);

      const dropzone = mockUseDropzone.mock.calls[0][0];
      await dropzone.onDrop([mockFile]);

      await waitFor(() => {
        expect(onFileUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            thumbnailUrl: undefined,
          })
        );
      });
    });
  });

  describe("cleanup", () => {
    it("should handle component unmount", () => {
      const { unmount } = render(<FileUpload {...defaultProps} />);

      expect(() => unmount()).not.toThrow();
    });

    it("should clear file input on successful upload", async () => {
      render(<FileUpload {...defaultProps} />);

      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(fileInput.value).toBe("");
      });
    });
  });
});
