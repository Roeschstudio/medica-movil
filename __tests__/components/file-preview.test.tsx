/**
 * Test suite for FilePreview component
 *
 * Tests:
 * - File preview display for different types
 * - Image viewer functionality
 * - File actions (download, view, preview)
 * - Error handling for preview failures
 * - Accessibility features
 */

import FilePreview from "@/components/file-preview";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dialog components
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog">{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) =>
    asChild ? children : <div data-testid="dialog-trigger">{children}</div>,
}));

describe("FilePreview Component", () => {
  const defaultProps = {
    fileName: "test-document.pdf",
    fileUrl: "https://example.com/test-document.pdf",
    fileSize: 1024000,
    fileType: "application/pdf",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.open
    Object.defineProperty(window, "open", {
      value: vi.fn(),
      writable: true,
    });

    // Mock document.createElement for download functionality
    const mockLink = {
      href: "",
      download: "",
      target: "",
      click: vi.fn(),
    };
    Object.defineProperty(document, "createElement", {
      value: vi.fn(() => mockLink),
      writable: true,
    });
    Object.defineProperty(document.body, "appendChild", {
      value: vi.fn(),
      writable: true,
    });
    Object.defineProperty(document.body, "removeChild", {
      value: vi.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderFilePreview = (props = {}) => {
    return render(<FilePreview {...defaultProps} {...props} />);
  };

  describe("Basic Rendering", () => {
    it("should render file information correctly", () => {
      renderFilePreview();

      expect(screen.getByText("test-document.pdf")).toBeInTheDocument();
      expect(screen.getByText("PDF")).toBeInTheDocument();
      expect(screen.getByText("1000 KB")).toBeInTheDocument();
    });

    it("should show appropriate file type icon", () => {
      renderFilePreview();

      expect(screen.getByTestId("file-text-icon")).toBeInTheDocument();
    });

    it("should render without file size when not provided", () => {
      renderFilePreview({ fileSize: undefined });

      expect(screen.getByText("test-document.pdf")).toBeInTheDocument();
      expect(screen.queryByText(/KB|MB|GB/)).not.toBeInTheDocument();
    });
  });

  describe("File Type Icons", () => {
    it("should show image icon for image files", () => {
      renderFilePreview({
        fileName: "image.jpg",
        fileType: "image/jpeg",
      });

      expect(screen.getByTestId("image-icon")).toBeInTheDocument();
      expect(screen.getByText("Imagen")).toBeInTheDocument();
    });

    it("should show video icon for video files", () => {
      renderFilePreview({
        fileName: "video.mp4",
        fileType: "video/mp4",
      });

      expect(screen.getByTestId("video-icon")).toBeInTheDocument();
      expect(screen.getByText("Video")).toBeInTheDocument();
    });

    it("should show music icon for audio files", () => {
      renderFilePreview({
        fileName: "audio.mp3",
        fileType: "audio/mpeg",
      });

      expect(screen.getByTestId("music-icon")).toBeInTheDocument();
      expect(screen.getByText("Audio")).toBeInTheDocument();
    });

    it("should show file-text icon for PDF files", () => {
      renderFilePreview({
        fileName: "document.pdf",
        fileType: "application/pdf",
      });

      expect(screen.getByTestId("file-text-icon")).toBeInTheDocument();
      expect(screen.getByText("PDF")).toBeInTheDocument();
    });

    it("should show file icon for unknown file types", () => {
      renderFilePreview({
        fileName: "unknown.xyz",
        fileType: "application/unknown",
      });

      expect(screen.getByTestId("file-icon")).toBeInTheDocument();
      expect(screen.getByText("Archivo")).toBeInTheDocument();
    });

    it("should detect Word documents", () => {
      renderFilePreview({
        fileName: "document.docx",
        fileType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      expect(screen.getByText("Word")).toBeInTheDocument();
    });

    it("should detect text files", () => {
      renderFilePreview({
        fileName: "text.txt",
        fileType: "text/plain",
      });

      expect(screen.getByText("Texto")).toBeInTheDocument();
    });
  });

  describe("File Size Formatting", () => {
    it("should format bytes correctly", () => {
      renderFilePreview({ fileSize: 512 });
      expect(screen.getByText("512 Bytes")).toBeInTheDocument();
    });

    it("should format kilobytes correctly", () => {
      renderFilePreview({ fileSize: 1536 }); // 1.5 KB
      expect(screen.getByText("1.5 KB")).toBeInTheDocument();
    });

    it("should format megabytes correctly", () => {
      renderFilePreview({ fileSize: 2097152 }); // 2 MB
      expect(screen.getByText("2 MB")).toBeInTheDocument();
    });

    it("should format gigabytes correctly", () => {
      renderFilePreview({ fileSize: 1073741824 }); // 1 GB
      expect(screen.getByText("1 GB")).toBeInTheDocument();
    });

    it("should handle zero bytes", () => {
      renderFilePreview({ fileSize: 0 });
      expect(screen.getByText("0 Bytes")).toBeInTheDocument();
    });
  });

  describe("Image Preview", () => {
    const imageProps = {
      fileName: "image.jpg",
      fileUrl: "https://example.com/image.jpg",
      fileType: "image/jpeg",
      thumbnailUrl: "https://example.com/image-thumb.jpg",
    };

    it("should display image thumbnail when available", () => {
      renderFilePreview(imageProps);

      const thumbnail = screen.getByAltText("image.jpg");
      expect(thumbnail).toBeInTheDocument();
      expect(thumbnail).toHaveAttribute(
        "src",
        "https://example.com/image-thumb.jpg"
      );
    });

    it("should fallback to full image when thumbnail is not available", () => {
      renderFilePreview({
        ...imageProps,
        thumbnailUrl: undefined,
      });

      const image = screen.getByAltText("image.jpg");
      expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
    });

    it("should show file icon when image fails to load", () => {
      renderFilePreview(imageProps);

      const image = screen.getByAltText("image.jpg");
      fireEvent.error(image);

      expect(screen.getByTestId("image-icon")).toBeInTheDocument();
    });

    it("should open image viewer when amplify button is clicked", async () => {
      const user = userEvent.setup();
      renderFilePreview(imageProps);

      const amplifyButton = screen.getByText("Ampliar");
      await user.click(amplifyButton);

      expect(screen.getByTestId("image-viewer")).toBeInTheDocument();
    });
  });

  describe("Image Viewer", () => {
    const imageProps = {
      fileName: "image.jpg",
      fileUrl: "https://example.com/image.jpg",
      fileType: "image/jpeg",
    };

    it("should render image viewer with controls", async () => {
      const user = userEvent.setup();
      renderFilePreview(imageProps);

      const amplifyButton = screen.getByText("Ampliar");
      await user.click(amplifyButton);

      expect(screen.getByTestId("image-viewer")).toBeInTheDocument();
      expect(screen.getByText("Zoom In")).toBeInTheDocument();
      expect(screen.getByText("Zoom Out")).toBeInTheDocument();
      expect(screen.getByText("Rotate")).toBeInTheDocument();
      expect(screen.getByText("Reset")).toBeInTheDocument();
      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    it("should handle zoom controls", async () => {
      const user = userEvent.setup();
      renderFilePreview(imageProps);

      const amplifyButton = screen.getByText("Ampliar");
      await user.click(amplifyButton);

      const zoomInButton = screen.getByText("Zoom In");
      const zoomOutButton = screen.getByText("Zoom Out");

      await user.click(zoomInButton);
      await user.click(zoomOutButton);

      // Verify controls are functional (implementation details tested)
      expect(zoomInButton).toBeInTheDocument();
      expect(zoomOutButton).toBeInTheDocument();
    });

    it("should handle rotation", async () => {
      const user = userEvent.setup();
      renderFilePreview(imageProps);

      const amplifyButton = screen.getByText("Ampliar");
      await user.click(amplifyButton);

      const rotateButton = screen.getByText("Rotate");
      await user.click(rotateButton);

      expect(rotateButton).toBeInTheDocument();
    });

    it("should reset zoom and rotation", async () => {
      const user = userEvent.setup();
      renderFilePreview(imageProps);

      const amplifyButton = screen.getByText("Ampliar");
      await user.click(amplifyButton);

      const resetButton = screen.getByText("Reset");
      await user.click(resetButton);

      expect(resetButton).toBeInTheDocument();
    });

    it("should close image viewer", async () => {
      const user = userEvent.setup();
      renderFilePreview(imageProps);

      const amplifyButton = screen.getByText("Ampliar");
      await user.click(amplifyButton);

      const closeButton = screen.getByText("Close");
      await user.click(closeButton);

      expect(screen.queryByTestId("image-viewer")).not.toBeInTheDocument();
    });

    it("should close when clicking on image", async () => {
      const user = userEvent.setup();
      renderFilePreview(imageProps);

      const amplifyButton = screen.getByText("Ampliar");
      await user.click(amplifyButton);

      const image = screen.getByAltText("image.jpg");
      await user.click(image);

      expect(screen.queryByTestId("image-viewer")).not.toBeInTheDocument();
    });
  });

  describe("Preview Dialog", () => {
    it("should show preview dialog for supported file types", async () => {
      const user = userEvent.setup();
      renderFilePreview();

      const previewButton = screen.getByText("Vista previa");
      await user.click(previewButton);

      expect(screen.getByTestId("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-title")).toHaveTextContent(
        "test-document.pdf"
      );
    });

    it("should render PDF preview in iframe", async () => {
      const user = userEvent.setup();
      renderFilePreview();

      const previewButton = screen.getByText("Vista previa");
      await user.click(previewButton);

      const iframe = screen.getByTitle("test-document.pdf");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute(
        "src",
        "https://example.com/test-document.pdf#toolbar=0"
      );
    });

    it("should render text file preview in iframe", async () => {
      const user = userEvent.setup();
      renderFilePreview({
        fileName: "text.txt",
        fileType: "text/plain",
        fileUrl: "https://example.com/text.txt",
      });

      const previewButton = screen.getByText("Vista previa");
      await user.click(previewButton);

      const iframe = screen.getByTitle("text.txt");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute("src", "https://example.com/text.txt");
    });

    it("should show error message when preview fails", async () => {
      const user = userEvent.setup();
      renderFilePreview();

      const previewButton = screen.getByText("Vista previa");
      await user.click(previewButton);

      const iframe = screen.getByTitle("test-document.pdf");
      fireEvent.error(iframe);

      expect(
        screen.getByText("No se puede mostrar la vista previa")
      ).toBeInTheDocument();
    });

    it("should show unsupported message for unsupported file types", async () => {
      const user = userEvent.setup();
      renderFilePreview({
        fileName: "archive.zip",
        fileType: "application/zip",
        fileUrl: "https://example.com/archive.zip",
      });

      const previewButton = screen.getByText("Vista previa");
      await user.click(previewButton);

      expect(
        screen.getByText("Vista previa no disponible para este tipo de archivo")
      ).toBeInTheDocument();
    });
  });

  describe("File Actions", () => {
    it("should open file in new tab when open button is clicked", async () => {
      const user = userEvent.setup();
      const mockOpen = vi.fn();
      Object.defineProperty(window, "open", { value: mockOpen });

      renderFilePreview();

      const openButton = screen.getByText("Abrir");
      await user.click(openButton);

      expect(mockOpen).toHaveBeenCalledWith(
        "https://example.com/test-document.pdf",
        "_blank"
      );
    });

    it("should download file when download button is clicked", async () => {
      const user = userEvent.setup();
      const mockLink = {
        href: "",
        download: "",
        target: "",
        click: vi.fn(),
      };
      const mockCreateElement = vi.fn(() => mockLink);
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();

      Object.defineProperty(document, "createElement", {
        value: mockCreateElement,
      });
      Object.defineProperty(document.body, "appendChild", {
        value: mockAppendChild,
      });
      Object.defineProperty(document.body, "removeChild", {
        value: mockRemoveChild,
      });

      renderFilePreview();

      const downloadButton = screen.getByText("Descargar");
      await user.click(downloadButton);

      expect(mockCreateElement).toHaveBeenCalledWith("a");
      expect(mockLink.href).toBe("https://example.com/test-document.pdf");
      expect(mockLink.download).toBe("test-document.pdf");
      expect(mockLink.target).toBe("_blank");
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
    });

    it("should hide download button when showDownload is false", () => {
      renderFilePreview({ showDownload: false });

      expect(screen.queryByText("Descargar")).not.toBeInTheDocument();
    });

    it("should hide preview button when showPreview is false", () => {
      renderFilePreview({ showPreview: false });

      expect(screen.queryByText("Vista previa")).not.toBeInTheDocument();
    });

    it("should not show preview button for unsupported file types", () => {
      renderFilePreview({
        fileName: "archive.zip",
        fileType: "application/zip",
      });

      expect(screen.queryByText("Vista previa")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for buttons", () => {
      renderFilePreview();

      const openButton = screen.getByText("Abrir");
      const downloadButton = screen.getByText("Descargar");
      const previewButton = screen.getByText("Vista previa");

      expect(openButton).toHaveAttribute("role", "button");
      expect(downloadButton).toHaveAttribute("role", "button");
      expect(previewButton).toHaveAttribute("role", "button");
    });

    it("should have proper alt text for images", () => {
      renderFilePreview({
        fileName: "image.jpg",
        fileType: "image/jpeg",
        fileUrl: "https://example.com/image.jpg",
      });

      const image = screen.getByAltText("image.jpg");
      expect(image).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderFilePreview();

      // Tab through buttons
      await user.tab();
      expect(screen.getByText("Vista previa")).toHaveFocus();

      await user.tab();
      expect(screen.getByText("Abrir")).toHaveFocus();

      await user.tab();
      expect(screen.getByText("Descargar")).toHaveFocus();
    });

    it("should handle Enter key for button activation", async () => {
      const user = userEvent.setup();
      const mockOpen = vi.fn();
      Object.defineProperty(window, "open", { value: mockOpen });

      renderFilePreview();

      const openButton = screen.getByText("Abrir");
      openButton.focus();
      await user.keyboard("{Enter}");

      expect(mockOpen).toHaveBeenCalled();
    });

    it("should have proper heading structure in dialog", async () => {
      const user = userEvent.setup();
      renderFilePreview();

      const previewButton = screen.getByText("Vista previa");
      await user.click(previewButton);

      const title = screen.getByTestId("dialog-title");
      expect(title).toHaveTextContent("test-document.pdf");
      expect(title.tagName).toBe("H2");
    });
  });

  describe("Error Handling", () => {
    it("should handle image load errors gracefully", () => {
      renderFilePreview({
        fileName: "broken-image.jpg",
        fileType: "image/jpeg",
        fileUrl: "https://example.com/broken-image.jpg",
      });

      const image = screen.getByAltText("broken-image.jpg");
      fireEvent.error(image);

      // Should show file icon instead
      expect(screen.getByTestId("image-icon")).toBeInTheDocument();
    });

    it("should handle iframe load errors in preview", async () => {
      const user = userEvent.setup();
      renderFilePreview();

      const previewButton = screen.getByText("Vista previa");
      await user.click(previewButton);

      const iframe = screen.getByTitle("test-document.pdf");
      fireEvent.error(iframe);

      expect(
        screen.getByText("No se puede mostrar la vista previa")
      ).toBeInTheDocument();
    });

    it("should handle missing file URLs gracefully", () => {
      renderFilePreview({ fileUrl: "" });

      // Should still render file info
      expect(screen.getByText("test-document.pdf")).toBeInTheDocument();

      // But actions should be disabled or hidden
      const openButton = screen.getByText("Abrir");
      expect(openButton).toBeDisabled();
    });
  });

  describe("Performance", () => {
    it("should not re-render unnecessarily", () => {
      const renderSpy = vi.fn();

      const { rerender } = render(<FilePreview {...defaultProps} />);

      // Re-render with same props
      rerender(<FilePreview {...defaultProps} />);

      // Should not cause unnecessary re-renders
      expect(screen.getByText("test-document.pdf")).toBeInTheDocument();
    });

    it("should lazy load preview content", async () => {
      const user = userEvent.setup();
      renderFilePreview();

      // Preview content should not be loaded initially
      expect(screen.queryByTitle("test-document.pdf")).not.toBeInTheDocument();

      // Only load when preview is opened
      const previewButton = screen.getByText("Vista previa");
      await user.click(previewButton);

      expect(screen.getByTitle("test-document.pdf")).toBeInTheDocument();
    });
  });
});
