/**
 * Test suite for VideoWaitingRoom component
 *
 * Tests:
 * - Waiting room initialization and setup
 * - Media preview functionality
 * - Appointment information display
 * - Participant management
 * - Session status tracking
 * - Join call functionality
 * - Time calculations and display
 * - Accessibility features
 */

import { VideoWaitingRoom } from "@/components/video-waiting-room";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(navigator, "mediaDevices", {
  value: {
    getUserMedia: mockGetUserMedia,
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
});

describe("VideoWaitingRoom Component", () => {
  const mockAppointmentData = {
    id: "apt-123",
    scheduledAt: "2024-01-15T14:00:00Z",
    doctor: {
      name: "Dr. Smith",
      specialty: "Cardiología",
      profileImage: "https://example.com/doctor.jpg",
    },
    patient: {
      name: "John Doe",
    },
  };

  const defaultProps = {
    sessionId: "session-123",
    appointmentData: mockAppointmentData,
    userRole: "patient" as const,
    onJoinCall: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock current time to be before appointment
    const mockDate = new Date("2024-01-15T13:30:00Z");
    vi.setSystemTime(mockDate);

    // Mock successful media access
    const mockAudioTrack = createMockTrack("audio");
    const mockVideoTrack = createMockTrack("video");
    const mockStream = createMockMediaStream([mockAudioTrack, mockVideoTrack]);
    mockGetUserMedia.mockResolvedValue(mockStream);

    // Mock successful API calls
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "WAITING" }),
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderVideoWaitingRoom = (props = {}) => {
    return render(<VideoWaitingRoom {...defaultProps} {...props} />);
  };

  describe("Basic Rendering", () => {
    it("should render waiting room with appointment details", async () => {
      renderVideoWaitingRoom();

      expect(screen.getByText("Camera Preview")).toBeInTheDocument();
      expect(screen.getByText("Appointment Details")).toBeInTheDocument();
      expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
      expect(screen.getByText("Cardiología")).toBeInTheDocument();
    });

    it("should show session information", async () => {
      renderVideoWaitingRoom();

      expect(screen.getByText("Session Status")).toBeInTheDocument();
      expect(screen.getByText("session-123").slice(-8)).toBeInTheDocument();
    });

    it("should render without appointment data", () => {
      renderVideoWaitingRoom({ appointmentData: undefined });

      expect(screen.getByText("Camera Preview")).toBeInTheDocument();
      expect(screen.getByText("Session Status")).toBeInTheDocument();
      expect(screen.queryByText("Appointment Details")).not.toBeInTheDocument();
    });
  });

  describe("Media Preview", () => {
    it("should initialize camera preview", async () => {
      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: true,
          audio: true,
        });
      });
    });

    it("should show ready status when media is initialized", async () => {
      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });
    });

    it("should show setting up status initially", () => {
      renderVideoWaitingRoom();

      expect(screen.getByText("Setting up...")).toBeInTheDocument();
    });

    it("should handle media access errors", async () => {
      mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      expect(screen.getByText("Setting up...")).toBeInTheDocument();
    });

    it("should render video element", () => {
      renderVideoWaitingRoom();

      const video = screen.getByRole("video");
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute("autoPlay");
      expect(video).toHaveAttribute("playsInline");
      expect(video).toHaveAttribute("muted");
    });
  });

  describe("Media Controls", () => {
    it("should toggle microphone when mute button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const mockAudioTrack = createMockTrack("audio", true);
      const mockStream = createMockMediaStream([mockAudioTrack]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
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

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });

      const videoButton = screen.getByRole("button", { name: /video/i });
      await user.click(videoButton);

      expect(mockVideoTrack.enabled).toBe(false);
    });

    it("should show video off indicator when video is disabled", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const mockVideoTrack = createMockTrack("video", true);
      const mockStream = createMockMediaStream([mockVideoTrack]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });

      const videoButton = screen.getByRole("button", { name: /video/i });
      await user.click(videoButton);

      expect(screen.getByTestId("video-off-icon")).toBeInTheDocument();
    });
  });

  describe("Appointment Information", () => {
    it("should display doctor information with avatar", () => {
      renderVideoWaitingRoom();

      expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
      expect(screen.getByText("Cardiología")).toBeInTheDocument();

      const avatar = screen.getByRole("img");
      expect(avatar).toHaveAttribute("src", "https://example.com/doctor.jpg");
    });

    it("should show scheduled time", () => {
      renderVideoWaitingRoom();

      expect(screen.getByText("Scheduled for:")).toBeInTheDocument();
      // Should show formatted date/time
      expect(screen.getByText(/15\/01\/2024/)).toBeInTheDocument();
    });

    it("should calculate and display time until appointment", () => {
      renderVideoWaitingRoom();

      expect(screen.getByText("Time until:")).toBeInTheDocument();
      expect(screen.getByText("30m")).toBeInTheDocument(); // 30 minutes until appointment
    });

    it("should show 'Now' when appointment time has passed", () => {
      // Set current time to after appointment
      const mockDate = new Date("2024-01-15T14:30:00Z");
      vi.setSystemTime(mockDate);

      renderVideoWaitingRoom();

      expect(screen.getByText("Now")).toBeInTheDocument();
    });

    it("should format time until appointment correctly", () => {
      // Test different time differences
      const testCases = [
        { currentTime: "2024-01-15T13:45:00Z", expected: "15m" },
        { currentTime: "2024-01-15T12:00:00Z", expected: "2h 0m" },
        { currentTime: "2024-01-14T14:00:00Z", expected: "1d 0h" },
      ];

      testCases.forEach(({ currentTime, expected }) => {
        vi.setSystemTime(new Date(currentTime));
        const { unmount } = renderVideoWaitingRoom();
        expect(screen.getByText(expected)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe("Session Status", () => {
    it("should fetch and display session status", async () => {
      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/video/session-123");
      });

      expect(screen.getByText("Waiting")).toBeInTheDocument();
    });

    it("should display session ID", () => {
      renderVideoWaitingRoom();

      expect(screen.getByText("Session ID:")).toBeInTheDocument();
      expect(screen.getByText("session-123".slice(-8))).toBeInTheDocument();
    });

    it("should handle different session statuses", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ACTIVE" }),
      });

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Active")).toBeInTheDocument();
      });
    });
  });

  describe("Participants Management", () => {
    it("should fetch and display participants", async () => {
      const mockParticipants = [
        { id: "1", name: "Dr. Smith", isConnected: true },
        { id: "2", name: "John Doe", isConnected: false },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "WAITING" }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockParticipants),
        });

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      expect(screen.getByText("1/2")).toBeInTheDocument(); // Connected/Total
    });

    it("should show participant connection status", async () => {
      const mockParticipants = [
        { id: "1", name: "Dr. Smith", isConnected: true },
        { id: "2", name: "John Doe", isConnected: false },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "WAITING" }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockParticipants),
        });

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
        expect(screen.getByText("Waiting")).toBeInTheDocument();
      });
    });

    it("should show empty state when no participants", async () => {
      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("No participants yet")).toBeInTheDocument();
      });
    });
  });

  describe("Join Call Functionality", () => {
    it("should enable join button when media is ready", async () => {
      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });

      const joinButton = screen.getByRole("button", {
        name: /join call|start call/i,
      });
      expect(joinButton).not.toBeDisabled();
    });

    it("should disable join button when media is not ready", () => {
      mockGetUserMedia.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      renderVideoWaitingRoom();

      const joinButton = screen.getByRole("button", {
        name: /join call|start call/i,
      });
      expect(joinButton).toBeDisabled();
    });

    it("should call onJoinCall when join button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onJoinCall = vi.fn();

      renderVideoWaitingRoom({ onJoinCall });

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });

      const joinButton = screen.getByRole("button", {
        name: /join call|start call/i,
      });
      await user.click(joinButton);

      expect(onJoinCall).toHaveBeenCalled();
    });

    it("should show error when trying to join without media access", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));

      renderVideoWaitingRoom();

      // Wait for media initialization to fail
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      const joinButton = screen.getByRole("button", {
        name: /join call|start call/i,
      });
      await user.click(joinButton);

      // Should show error toast (mocked)
      expect(
        screen.getByText("Please allow camera and microphone access")
      ).toBeInTheDocument();
    });

    it("should show different button text based on session status", async () => {
      // Test with active session
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ACTIVE" }),
      });

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Join Call")).toBeInTheDocument();
      });
    });
  });

  describe("Polling and Updates", () => {
    it("should poll for status updates", async () => {
      renderVideoWaitingRoom();

      // Initial calls
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/video/session-123");
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/video/session-123/participants"
        );
      });

      // Fast-forward 5 seconds to trigger polling
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(4); // 2 initial + 2 polling
      });
    });

    it("should update time until appointment every minute", () => {
      renderVideoWaitingRoom();

      expect(screen.getByText("30m")).toBeInTheDocument();

      // Fast-forward 1 minute
      vi.advanceTimersByTime(60000);

      expect(screen.getByText("29m")).toBeInTheDocument();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup media streams on unmount", async () => {
      const mockAudioTrack = createMockTrack("audio");
      const mockVideoTrack = createMockTrack("video");
      const mockStream = createMockMediaStream([
        mockAudioTrack,
        mockVideoTrack,
      ]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { unmount } = renderVideoWaitingRoom();

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      unmount();

      expect(mockAudioTrack.stop).toHaveBeenCalled();
      expect(mockVideoTrack.stop).toHaveBeenCalled();
    });

    it("should clear intervals on unmount", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      const { unmount } = renderVideoWaitingRoom();

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      renderVideoWaitingRoom();

      // Should not crash
      expect(screen.getByText("Camera Preview")).toBeInTheDocument();
    });

    it("should handle media stream errors", async () => {
      mockGetUserMedia.mockRejectedValue(new Error("Camera not available"));

      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Should show setting up status
      expect(screen.getByText("Setting up...")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper button roles and labels", async () => {
      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /mic/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /video/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /settings/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /join call|start call/i })
      ).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });

      // Tab through controls
      await user.tab();
      expect(screen.getByRole("button", { name: /mic/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("button", { name: /video/i })).toHaveFocus();
    });

    it("should have proper video element attributes", () => {
      renderVideoWaitingRoom();

      const video = screen.getByRole("video");
      expect(video).toHaveAttribute("autoPlay");
      expect(video).toHaveAttribute("playsInline");
      expect(video).toHaveAttribute("muted");
    });
  });

  describe("Visual States", () => {
    it("should show correct button states based on media status", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderVideoWaitingRoom();

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
      });

      // Initially should show enabled states
      expect(screen.getByTestId("mic-icon")).toBeInTheDocument();
      expect(screen.getByTestId("video-icon")).toBeInTheDocument();

      // After muting
      const muteButton = screen.getByRole("button", { name: /mic/i });
      await user.click(muteButton);
      expect(screen.getByTestId("mic-off-icon")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      renderVideoWaitingRoom({ className: "custom-waiting-room" });

      const container = screen
        .getByText("Camera Preview")
        .closest(".custom-waiting-room");
      expect(container).toBeInTheDocument();
    });

    it("should show participant connection indicators", async () => {
      const mockParticipants = [
        { id: "1", name: "Dr. Smith", isConnected: true },
        { id: "2", name: "John Doe", isConnected: false },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "WAITING" }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockParticipants),
        });

      renderVideoWaitingRoom();

      await waitFor(() => {
        const indicators = screen
          .getAllByRole("generic")
          .filter((el) => el.className.includes("rounded-full"));
        expect(indicators.length).toBeGreaterThan(0);
      });
    });
  });
});
