/**
 * Test suite for FileUpload component
 *
 * Tests:
 * - File selection and drag-and-drop
 * - File validation (size, type)
 * - Upload progress and status
 * - Error handling
 * - Multiple file uploads
 * - Accessibility features
 */

import FileUpload, { UploadedFile } from "@/src/components/files/FileUpload";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase client
const mockSupabaseClient = {
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
    })),
  },
};

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => mockSupabaseClient,
}));

vi.mock("@/hooks/use-file-upload-error-handler", () => ({
  useFileUploadErrorHandler: () => ({
    handleError: vi.fn((error) => error),
    retryOperation: vi.fn((fn) => fn()),
  }),
}));

vi.mock("@/hooks/use-offline-aware-operation", () => ({
  useOfflineAwareOperation: (operation: any) => ({
    executeOperation: operation,
  }),
}));

// Mock file for testing
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(["test content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("FileUpload Component", () => {
  const defaultProps = {
    onFileUpload: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful upload by default
    mockSupabaseClient.storage.from().upload.mockResolvedValue({
      data: { path: "chat-files/test-file.pdf" },
      error: null,
    });

    mockSupabaseClient.storage.from().getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/test-file.pdf" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderFileUpload = (props = {}) => {
    return render(<FileUpload {...defaultProps} {...props} />);
  };

  describe("Basic Rendering", () => {
    it("should render upload area with instructions", () => {
      renderFileUpload();

      expect(
        screen.getByText("Arrastra archivos aquí o haz clic para seleccionar")
      ).toBeInTheDocument();
      expect(screen.getByText("Máximo 10MB por archivo")).toBeInTheDocument();
      expect(
        screen.getByText("Tipos permitidos: Imágenes, PDF, Word, Video, Audio")
      ).toBeInTheDocument();
      expect(screen.getByText("Seleccionar archivos")).toBeInTheDocument();
    });

    it("should show custom max file size", () => {
      renderFileUpload({ maxFileSize: 5 });

      expect(screen.getByText("Máximo 5MB por archivo")).toBeInTheDocument();
    });

    it("should be disabled when disabled prop is true", () => {
      renderFileUpload({ disabled: true });

      const uploadArea = screen
        .getByText("Seleccionar archivos")
        .closest(".cursor-not-allowed");
      expect(uploadArea).toBeInTheDocument();

      const selectButton = screen.getByText("Seleccionar archivos");
      expect(selectButton).toBeDisabled();
    });
  });

  describe("File Selection", () => {
    it("should handle file selection via button click", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      // Simulate file selection
      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText("test.pdf")).toBeInTheDocument();
        expect(screen.getByText("Subiendo...")).toBeInTheDocument();
      });
    });

    it("should handle multiple file selection when multiple is true", async () => {
      const user = userEvent.setup();
      const files = [
        createMockFile("test1.pdf", 1024, "application/pdf"),
        createMockFile("test2.jpg", 2048, "image/jpeg"),
      ];

      renderFileUpload({ multiple: true });

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, files);

      await waitFor(() => {
        expect(screen.getByText("test1.pdf")).toBeInTheDocument();
        expect(screen.getByText("test2.jpg")).toBeInTheDocument();
      });
    });

    it("should reject multiple files when multiple is false", async () => {
      const user = userEvent.setup();
      const files = [
        createMockFile("test1.pdf", 1024, "application/pdf"),
        createMockFile("test2.jpg", 2048, "image/jpeg"),
      ];

      renderFileUpload({ multiple: false });

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, files);

      // Should only process the first file
      await waitFor(() => {
        expect(screen.getByText("test1.pdf")).toBeInTheDocument();
        expect(screen.queryByText("test2.jpg")).not.toBeInTheDocument();
      });
    });
  });

  describe("Drag and Drop", () => {
    it("should handle drag and drop", async () => {
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload();

      const dropzone = screen
        .getByText("Arrastra archivos aquí o haz clic para seleccionar")
        .closest('[role="button"]');

      // Simulate drag enter
      fireEvent.dragEnter(dropzone!, {
        dataTransfer: {
          files: [file],
          types: ["Files"],
        },
      });

      expect(screen.getByText("Suelta los archivos aquí")).toBeInTheDocument();

      // Simulate drop
      fireEvent.drop(dropzone!, {
        dataTransfer: {
          files: [file],
          types: ["Files"],
        },
      });

      await waitFor(() => {
        expect(screen.getByText("test.pdf")).toBeInTheDocument();
      });
    });

    it("should show drag active state", () => {
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload();

      const dropzone = screen
        .getByText("Arrastra archivos aquí o haz clic para seleccionar")
        .closest('[role="button"]');

      fireEvent.dragEnter(dropzone!, {
        dataTransfer: {
          files: [file],
          types: ["Files"],
        },
      });

      expect(screen.getByText("Suelta los archivos aquí")).toBeInTheDocument();
      expect(dropzone).toHaveClass("border-primary", "bg-primary/5");
    });
  });

  describe("File Validation", () => {
    it("should reject files that are too large", async () => {
      const user = userEvent.setup();
      const largeFile = createMockFile(
        "large.pdf",
        15 * 1024 * 1024,
        "application/pdf"
      ); // 15MB

      renderFileUpload({ maxFileSize: 10 });

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, largeFile);

      await waitFor(() => {
        expect(
          screen.getByText(
            "El archivo es demasiado grande. Máximo 10MB permitido."
          )
        ).toBeInTheDocument();
        expect(screen.getByText("Error")).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith(
        "El archivo es demasiado grande. Máximo 10MB permitido."
      );
    });

    it("should reject files with disallowed types", async () => {
      const user = userEvent.setup();
      const disallowedFile = createMockFile(
        "test.exe",
        1024,
        "application/x-executable"
      );

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, disallowedFile);

      await waitFor(() => {
        expect(
          screen.getByText("Tipo de archivo no permitido.")
        ).toBeInTheDocument();
        expect(screen.getByText("Error")).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith(
        "Tipo de archivo no permitido."
      );
    });

    it("should accept files with allowed types", async () => {
      const user = userEvent.setup();
      const allowedFile = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload({ allowedTypes: ["application/pdf"] });

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, allowedFile);

      await waitFor(() => {
        expect(screen.getByText("test.pdf")).toBeInTheDocument();
        expect(screen.getByText("Subiendo...")).toBeInTheDocument();
      });
    });

    it("should accept wildcard types", async () => {
      const user = userEvent.setup();
      const imageFile = createMockFile("test.jpg", 1024, "image/jpeg");

      renderFileUpload({ allowedTypes: ["image/*"] });

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, imageFile);

      await waitFor(() => {
        expect(screen.getByText("test.jpg")).toBeInTheDocument();
      });
    });
  });

  describe("Upload Progress", () => {
    it("should show upload progress", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText("Subiendo...")).toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
      });
    });

    it("should show completion status", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText("Completado")).toBeInTheDocument();
        expect(screen.getByText("Ver")).toBeInTheDocument();
        expect(screen.getByText("Descargar")).toBeInTheDocument();
      });

      const expectedUploadedFile: UploadedFile = {
        id: expect.any(String),
        name: "test.pdf",
        size: 1024,
        type: "application/pdf",
        url: "https://example.com/test-file.pdf",
      };

      expect(defaultProps.onFileUpload).toHaveBeenCalledWith(
        expectedUploadedFile
      );
    });

    it("should show file size in human readable format", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024 * 1024, "application/pdf"); // 1MB

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText("1 MB")).toBeInTheDocument();
      });
    });
  });

  describe("File Icons", () => {
    it("should show appropriate icons for different file types", async () => {
      const user = userEvent.setup();
      const files = [
        createMockFile("image.jpg", 1024, "image/jpeg"),
        createMockFile("video.mp4", 1024, "video/mp4"),
        createMockFile("audio.mp3", 1024, "audio/mpeg"),
        createMockFile("document.pdf", 1024, "application/pdf"),
        createMockFile("text.txt", 1024, "text/plain"),
      ];

      renderFileUpload({ multiple: true });

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, files);

      await waitFor(() => {
        expect(screen.getByTestId("image-icon")).toBeInTheDocument();
        expect(screen.getByTestId("video-icon")).toBeInTheDocument();
        expect(screen.getByTestId("music-icon")).toBeInTheDocument();
        expect(screen.getByTestId("file-text-icon")).toBeInTheDocument();
        expect(screen.getByTestId("file-icon")).toBeInTheDocument();
      });
    });
  });

  describe("File Actions", () => {
    it("should allow removing upload items", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText("test.pdf")).toBeInTheDocument();
      });

      const removeButton = screen.getByRole("button", { name: /remove/i });
      await user.click(removeButton);

      expect(screen.queryByText("test.pdf")).not.toBeInTheDocument();
    });

    it("should allow viewing completed uploads", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      // Mock window.open
      const mockOpen = vi.fn();
      Object.defineProperty(window, "open", { value: mockOpen });

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText("Completado")).toBeInTheDocument();
      });

      const viewButton = screen.getByText("Ver");
      await user.click(viewButton);

      expect(mockOpen).toHaveBeenCalledWith(
        "https://example.com/test-file.pdf",
        "_blank"
      );
    });

    it("should allow downloading completed uploads", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      // Mock document.createElement and click
      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      };
      const mockCreateElement = vi.fn(() => mockLink);
      Object.defineProperty(document, "createElement", {
        value: mockCreateElement,
      });

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText("Completado")).toBeInTheDocument();
      });

      const downloadButton = screen.getByText("Descargar");
      await user.click(downloadButton);

      expect(mockCreateElement).toHaveBeenCalledWith("a");
      expect(mockLink.href).toBe("https://example.com/test-file.pdf");
      expect(mockLink.download).toBe("test.pdf");
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle upload errors", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      // Mock upload failure
      mockSupabaseClient.storage
        .from()
        .upload.mockRejectedValue(new Error("Upload failed"));

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Upload failed")).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalled();
    });

    it("should retry failed uploads", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      // Mock upload failure then success
      mockSupabaseClient.storage
        .from()
        .upload.mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          data: { path: "chat-files/test-file.pdf" },
          error: null,
        });

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      // Should eventually succeed due to retry logic
      await waitFor(
        () => {
          expect(screen.getByText("Completado")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe("Thumbnail Generation", () => {
    it("should generate thumbnails for images", async () => {
      const user = userEvent.setup();
      const imageFile = createMockFile("image.jpg", 1024, "image/jpeg");

      // Mock thumbnail URL
      mockSupabaseClient.storage
        .from()
        .getPublicUrl.mockReturnValueOnce({
          data: { publicUrl: "https://example.com/image.jpg" },
        })
        .mockReturnValueOnce({
          data: { publicUrl: "https://example.com/image-thumb.jpg" },
        });

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, imageFile);

      await waitFor(() => {
        expect(screen.getByText("Completado")).toBeInTheDocument();
      });

      const expectedUploadedFile: UploadedFile = {
        id: expect.any(String),
        name: "image.jpg",
        size: 1024,
        type: "image/jpeg",
        url: "https://example.com/image.jpg",
        thumbnailUrl: "https://example.com/image-thumb.jpg",
      };

      expect(defaultProps.onFileUpload).toHaveBeenCalledWith(
        expectedUploadedFile
      );
    });

    it("should handle thumbnail generation errors gracefully", async () => {
      const user = userEvent.setup();
      const imageFile = createMockFile("image.jpg", 1024, "image/jpeg");

      // Mock thumbnail generation failure
      mockSupabaseClient.storage
        .from()
        .getPublicUrl.mockReturnValueOnce({
          data: { publicUrl: "https://example.com/image.jpg" },
        })
        .mockImplementationOnce(() => {
          throw new Error("Thumbnail generation failed");
        });

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, imageFile);

      await waitFor(() => {
        expect(screen.getByText("Completado")).toBeInTheDocument();
      });

      // Should still complete upload without thumbnail
      const expectedUploadedFile: UploadedFile = {
        id: expect.any(String),
        name: "image.jpg",
        size: 1024,
        type: "image/jpeg",
        url: "https://example.com/image.jpg",
        thumbnailUrl: undefined,
      };

      expect(defaultProps.onFileUpload).toHaveBeenCalledWith(
        expectedUploadedFile
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      renderFileUpload();

      const dropzone = screen.getByRole("button");
      expect(dropzone).toHaveAttribute(
        "aria-label",
        expect.stringContaining("upload")
      );

      const fileInput = screen.getByRole("button", { hidden: true });
      expect(fileInput).toHaveAttribute("accept");
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");

      // Tab should focus the button
      await user.tab();
      expect(selectButton).toHaveFocus();

      // Enter should trigger file selection
      await user.keyboard("{Enter}");
      // File input should be triggered (tested indirectly)
    });

    it("should announce upload progress to screen readers", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar).toHaveAttribute("aria-valuenow");
        expect(progressBar).toHaveAttribute("aria-valuemin", "0");
        expect(progressBar).toHaveAttribute("aria-valuemax", "100");
      });
    });
  });

  describe("Performance", () => {
    it("should handle multiple concurrent uploads efficiently", async () => {
      const user = userEvent.setup();
      const files = Array.from({ length: 5 }, (_, i) =>
        createMockFile(`test${i}.pdf`, 1024, "application/pdf")
      );

      renderFileUpload({ multiple: true });

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });

      const startTime = performance.now();
      await user.upload(fileInput, files);

      await waitFor(
        () => {
          expect(screen.getAllByText("Completado")).toHaveLength(5);
        },
        { timeout: 10000 }
      );

      const endTime = performance.now();

      // Should complete all uploads within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      expect(defaultProps.onFileUpload).toHaveBeenCalledTimes(5);
    });

    it("should not block UI during upload", async () => {
      const user = userEvent.setup();
      const file = createMockFile("test.pdf", 1024, "application/pdf");

      renderFileUpload();

      const selectButton = screen.getByText("Seleccionar archivos");
      await user.click(selectButton);

      const fileInput = screen.getByRole("button", { hidden: true });
      await user.upload(fileInput, file);

      // UI should remain responsive during upload
      const removeButton = screen.getByRole("button", { name: /remove/i });
      expect(removeButton).toBeEnabled();

      await user.click(removeButton);
      expect(screen.queryByText("test.pdf")).not.toBeInTheDocument();
    });
  });
});
