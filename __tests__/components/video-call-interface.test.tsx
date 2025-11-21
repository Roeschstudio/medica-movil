/**
 * Test suite for VideoCallInterface component
 *
 * Tests:
 * - Video call initialization and setup
 * - Media controls (mute, video, screen share)
 * - Call duration tracking
 * - Participant management
 * - Connection status handling
 * - Error handling and recovery
 * - Accessibility features
 */

import { VideoCallInterface } from "@/components/video-call-interface";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
const mockGetDisplayMedia = vi.fn();

Object.defineProperty(navigator, "mediaDevices", {
  value: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: mockGetDisplayMedia,
  },
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock media stream
const createMockMediaStream = (tracks: any[] = []) => {
  const mockStream = {
    getTracks: vi.fn(() => tracks),
    getAudioTracks: vi.fn(() => tracks.filter((t) => t.kind === "audio")),
    getVideoTracks: vi.fn(() => tracks.filter((t) => t.kind === "video")),
  };
  return mockStream as unknown as MediaStream;
};

const createMockTrack = (kind: "audio" | "video", enabled = true) => ({
  kind,
  enabled,
  stop: vi.fn(),
  onended: null,
});

describe("VideoCallInterface Component", () => {
  const defaultProps = {
    sessionId: "session-123",
    isInitiator: false,
    onCallEnd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock successful media access by default
    const mockAudioTrack = createMockTrack("audio");
    const mockVideoTrack = createMockTrack("video");
    const mockStream = createMockMediaStream([mockAudioTrack, mockVideoTrack]);

    mockGetUserMedia.mockResolvedValue(mockStream);
    mockGetDisplayMedia.mockResolvedValue(mockStream);

    // Mock successful API calls
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderVideoCallInterface = (props = {}) => {
    return render(<VideoCallInterface {...defaultProps} {...props} />);
  };

  describe("Initialization", () => {
    it("should render video call interface", async () => {
      renderVideoCallInterface();

      expect(screen.getByText("Connecting...")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("should initialize local media stream", async () => {
      renderVideoCallInterface();

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: true,
          audio: true,
        });
      });
    });

    it("should join session on initialization", async () => {
      renderVideoCallInterface();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/video/session-123/participants",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ action: "join" }),
          })
        );
      });
    });

    it("should fetch participants on initialization", async () => {
      renderVideoCallInterface();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/video/session-123/participants"
        );
      });
    });
  });

  describe("Connection Status", () => {
    it("should show connecting status initially", () => {
      renderVideoCallInterface();

      expect(screen.getByText("Connecting...")).toBeInTheDocument();
    });

    it("should show connected status after successful initialization", async () => {
      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("should handle media access errors", async () => {
      mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));
      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connecting...")).toBeInTheDocument();
      });
    });
  });

  describe("Call Duration", () => {
    it("should display call duration when call is active", async () => {
      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      // Fast-forward time
      vi.advanceTimersByTime(65000); // 1 minute 5 seconds

      await waitFor(() => {
        expect(screen.getByText("01:05")).toBeInTheDocument();
      });
    });

    it("should format duration correctly", async () => {
      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      // Test different durations
      vi.advanceTimersByTime(5000); // 5 seconds
      await waitFor(() => {
        expect(screen.getByText("00:05")).toBeInTheDocument();
      });

      vi.advanceTimersByTime(55000); // Total 1 minute
      await waitFor(() => {
        expect(screen.getByText("01:00")).toBeInTheDocument();
      });
    });
  });

  describe("Media Controls", () => {
    it("should toggle microphone when mute button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const mockAudioTrack = createMockTrack("audio", true);
      const mockStream = createMockMediaStream([mockAudioTrack]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const muteButton = screen.getByRole("button", { name: /mic/i });
      await user.click(muteButton);

      expect(mockAudioTrack.enabled).toBe(false);
    });

    it("should toggle video when video button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const mockVideoTrack = createMockTrack("video", true);
      const mockStream = createMockMediaStream([mockVideoTrack]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const videoButton = screen.getByRole("button", { name: /video/i });
      await user.click(videoButton);

      expect(mockVideoTrack.enabled).toBe(false);
    });

    it("should start screen sharing when screen share button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const mockScreenTrack = createMockTrack("video", true);
      const mockScreenStream = createMockMediaStream([mockScreenTrack]);
      mockGetDisplayMedia.mockResolvedValue(mockScreenStream);

      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const screenShareButton = screen.getByRole("button", {
        name: /monitor/i,
      });
      await user.click(screenShareButton);

      await waitFor(() => {
        expect(mockGetDisplayMedia).toHaveBeenCalledWith({
          video: true,
          audio: true,
        });
        expect(screen.getByText("Screen Sharing")).toBeInTheDocument();
      });
    });

    it("should stop screen sharing when clicked again", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const mockScreenTrack = createMockTrack("video", true);
      const mockScreenStream = createMockMediaStream([mockScreenTrack]);
      mockGetDisplayMedia.mockResolvedValue(mockScreenStream);

      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const screenShareButton = screen.getByRole("button", {
        name: /monitor/i,
      });

      // Start screen sharing
      await user.click(screenShareButton);
      await waitFor(() => {
        expect(screen.getByText("Screen Sharing")).toBeInTheDocument();
      });

      // Stop screen sharing
      await user.click(screenShareButton);
      await waitFor(() => {
        expect(screen.queryByText("Screen Sharing")).not.toBeInTheDocument();
      });

      expect(mockScreenTrack.stop).toHaveBeenCalled();
    });
  });

  describe("Call Management", () => {
    it("should end call when end call button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onCallEnd = vi.fn();

      renderVideoCallInterface({ onCallEnd });

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const endCallButton = screen.getByRole("button", { name: /phone-off/i });
      await user.click(endCallButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/video/session-123/participants",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ action: "leave" }),
          })
        );
        expect(onCallEnd).toHaveBeenCalled();
      });
    });

    it("should cleanup media streams on unmount", () => {
      const mockAudioTrack = createMockTrack("audio");
      const mockVideoTrack = createMockTrack("video");
      const mockStream = createMockMediaStream([
        mockAudioTrack,
        mockVideoTrack,
      ]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { unmount } = renderVideoCallInterface();

      unmount();

      expect(mockAudioTrack.stop).toHaveBeenCalled();
      expect(mockVideoTrack.stop).toHaveBeenCalled();
    });
  });

  describe("Participant Display", () => {
    it("should display participant count", async () => {
      const mockParticipants = [
        { id: "1", name: "User 1", isConnected: true },
        { id: "2", name: "User 2", isConnected: true },
        { id: "3", name: "User 3", isConnected: false },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockParticipants),
      });

      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("2")).toBeInTheDocument(); // Only connected participants
      });
    });
  });

  describe("Video Elements", () => {
    it("should render local and remote video elements", () => {
      renderVideoCallInterface();

      const videos = screen.getAllByRole("video");
      expect(videos).toHaveLength(2); // Local and remote video
    });

    it("should show video off indicator when video is disabled", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const mockVideoTrack = createMockTrack("video", true);
      const mockStream = createMockMediaStream([mockVideoTrack]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const videoButton = screen.getByRole("button", { name: /video/i });
      await user.click(videoButton);

      expect(screen.getByTestId("video-off-icon")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle media access errors gracefully", async () => {
      mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));

      renderVideoCallInterface();

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Should not crash and should show appropriate state
      expect(screen.getByText("Connecting...")).toBeInTheDocument();
    });

    it("should handle screen share errors", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockGetDisplayMedia.mockRejectedValue(new Error("Screen share denied"));

      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const screenShareButton = screen.getByRole("button", {
        name: /monitor/i,
      });
      await user.click(screenShareButton);

      await waitFor(() => {
        expect(mockGetDisplayMedia).toHaveBeenCalled();
      });

      // Should not show screen sharing indicator on error
      expect(screen.queryByText("Screen Sharing")).not.toBeInTheDocument();
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      renderVideoCallInterface();

      // Should not crash
      expect(screen.getByText("Connecting...")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper button roles and labels", async () => {
      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /mic/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /video/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /monitor/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /phone-off/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /settings/i })
      ).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      // Tab through controls
      await user.tab();
      expect(screen.getByRole("button", { name: /mic/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("button", { name: /video/i })).toHaveFocus();
    });

    it("should have proper video element attributes", () => {
      renderVideoCallInterface();

      const videos = screen.getAllByRole("video");
      videos.forEach((video) => {
        expect(video).toHaveAttribute("autoPlay");
        expect(video).toHaveAttribute("playsInline");
      });

      // Local video should be muted
      const localVideo = videos.find((video) => video.hasAttribute("muted"));
      expect(localVideo).toBeInTheDocument();
    });
  });

  describe("Visual States", () => {
    it("should show correct button states based on media status", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      // Initially should show enabled states
      expect(screen.getByTestId("mic-icon")).toBeInTheDocument();
      expect(screen.getByTestId("video-icon")).toBeInTheDocument();

      // After muting
      const muteButton = screen.getByRole("button", { name: /mic/i });
      await user.click(muteButton);
      expect(screen.getByTestId("mic-off-icon")).toBeInTheDocument();

      // After disabling video
      const videoButton = screen.getByRole("button", { name: /video/i });
      await user.click(videoButton);
      expect(screen.getByTestId("video-off-icon")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      renderVideoCallInterface({ className: "custom-video-class" });

      const container = screen
        .getByText("Connecting...")
        .closest(".custom-video-class");
      expect(container).toBeInTheDocument();
    });
  });

  describe("Screen Share Lifecycle", () => {
    it("should handle screen share track ending", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const mockScreenTrack = createMockTrack("video", true);
      const mockScreenStream = createMockMediaStream([mockScreenTrack]);
      mockGetDisplayMedia.mockResolvedValue(mockScreenStream);

      renderVideoCallInterface();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const screenShareButton = screen.getByRole("button", {
        name: /monitor/i,
      });
      await user.click(screenShareButton);

      await waitFor(() => {
        expect(screen.getByText("Screen Sharing")).toBeInTheDocument();
      });

      // Simulate track ending (user stops sharing from browser)
      if (mockScreenTrack.onended) {
        mockScreenTrack.onended();
      }

      await waitFor(() => {
        expect(screen.queryByText("Screen Sharing")).not.toBeInTheDocument();
      });
    });
  });
});
