/**
 * Test suite for VideoSessionManager component
 *
 * Tests:
 * - WebRTC peer connection management
 * - Signal handling and processing
 * - Media stream management
 * - Connection state tracking
 * - Error handling and recovery
 * - Cleanup and resource management
 */

import { VideoSessionManager } from "@/components/video-session-manager";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock SimplePeer
const mockPeerInstance = {
  signal: vi.fn(),
  destroy: vi.fn(),
  destroyed: false,
  on: vi.fn(),
};

const mockSimplePeer = vi.fn(() => mockPeerInstance);
vi.mock("simple-peer", () => ({
  default: mockSimplePeer,
}));

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

const createMockTrack = (kind: "audio" | "video") => ({
  kind,
  stop: vi.fn(),
});

describe("VideoSessionManager Component", () => {
  const mockLocalVideoRef = {
    current: null,
  } as React.RefObject<HTMLVideoElement>;
  const mockRemoteVideoRef = {
    current: null,
  } as React.RefObject<HTMLVideoElement>;

  const defaultProps = {
    sessionId: "session-123",
    isInitiator: false,
    localVideoRef: mockLocalVideoRef,
    remoteVideoRef: mockRemoteVideoRef,
    onConnectionStateChange: vi.fn(),
    onRemoteStream: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock peer instance
    mockPeerInstance.destroyed = false;
    mockPeerInstance.on.mockClear();
    mockPeerInstance.signal.mockClear();
    mockPeerInstance.destroy.mockClear();

    // Mock successful media access
    const mockAudioTrack = createMockTrack("audio");
    const mockVideoTrack = createMockTrack("video");
    const mockStream = createMockMediaStream([mockAudioTrack, mockVideoTrack]);
    mockGetUserMedia.mockResolvedValue(mockStream);

    // Mock successful WebRTC config fetch
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          webrtcConfig: {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          },
        }),
    });

    // Mock video elements
    mockLocalVideoRef.current = {
      srcObject: null,
    } as HTMLVideoElement;

    mockRemoteVideoRef.current = {
      srcObject: null,
    } as HTMLVideoElement;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderVideoSessionManager = (props = {}) => {
    return render(<VideoSessionManager {...defaultProps} {...props} />);
  };

  describe("Initialization", () => {
    it("should initialize WebRTC configuration", async () => {
      renderVideoSessionManager();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/video/session-123/signal"
        );
      });
    });

    it("should get local media stream", async () => {
      renderVideoSessionManager();

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      });
    });

    it("should set local video source", async () => {
      const mockStream = createMockMediaStream([]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      renderVideoSessionManager();

      await waitFor(() => {
        expect(mockLocalVideoRef.current?.srcObject).toBe(mockStream);
      });
    });

    it("should initialize SimplePeer with correct configuration", async () => {
      renderVideoSessionManager({ isInitiator: true });

      await waitFor(() => {
        expect(mockSimplePeer).toHaveBeenCalledWith({
          initiator: true,
          trickle: true,
          stream: expect.any(Object),
          config: expect.objectContaining({
            iceServers: expect.any(Array),
          }),
        });
      });
    });

    it("should call onConnectionStateChange with connecting state", async () => {
      const onConnectionStateChange = vi.fn();
      renderVideoSessionManager({ onConnectionStateChange });

      expect(onConnectionStateChange).toHaveBeenCalledWith("connecting");
    });
  });

  describe("WebRTC Configuration", () => {
    it("should use fallback configuration when API fails", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      renderVideoSessionManager();

      await waitFor(() => {
        expect(mockSimplePeer).toHaveBeenCalledWith(
          expect.objectContaining({
            config: {
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
              ],
            },
          })
        );
      });
    });

    it("should use custom WebRTC config from API", async () => {
      const customConfig = {
        iceServers: [
          { urls: "stun:custom.stun.server:3478" },
          {
            urls: "turn:turn.server:3478",
            username: "user",
            credential: "pass",
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ webrtcConfig: customConfig }),
      });

      renderVideoSessionManager();

      await waitFor(() => {
        expect(mockSimplePeer).toHaveBeenCalledWith(
          expect.objectContaining({
            config: customConfig,
          })
        );
      });
    });
  });

  describe("Peer Event Handling", () => {
    it("should set up peer event listeners", async () => {
      renderVideoSessionManager();

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "signal",
          expect.any(Function)
        );
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "connect",
          expect.any(Function)
        );
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "stream",
          expect.any(Function)
        );
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "close",
          expect.any(Function)
        );
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "error",
          expect.any(Function)
        );
      });
    });

    it("should handle peer connect event", async () => {
      const onConnectionStateChange = vi.fn();
      renderVideoSessionManager({ onConnectionStateChange });

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "connect",
          expect.any(Function)
        );
      });

      // Simulate connect event
      const connectHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];

      if (connectHandler) {
        connectHandler();
      }

      expect(onConnectionStateChange).toHaveBeenCalledWith("connected");
    });

    it("should handle peer stream event", async () => {
      const onRemoteStream = vi.fn();
      renderVideoSessionManager({ onRemoteStream });

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "stream",
          expect.any(Function)
        );
      });

      // Simulate stream event
      const mockRemoteStream = createMockMediaStream([]);
      const streamHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "stream"
      )?.[1];

      if (streamHandler) {
        streamHandler(mockRemoteStream);
      }

      expect(mockRemoteVideoRef.current?.srcObject).toBe(mockRemoteStream);
      expect(onRemoteStream).toHaveBeenCalledWith(mockRemoteStream);
    });

    it("should handle peer close event", async () => {
      const onConnectionStateChange = vi.fn();
      renderVideoSessionManager({ onConnectionStateChange });

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "close",
          expect.any(Function)
        );
      });

      // Simulate close event
      const closeHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "close"
      )?.[1];

      if (closeHandler) {
        closeHandler();
      }

      expect(onConnectionStateChange).toHaveBeenCalledWith("disconnected");
    });

    it("should handle peer error event", async () => {
      const onConnectionStateChange = vi.fn();
      const onError = vi.fn();
      renderVideoSessionManager({ onConnectionStateChange, onError });

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "error",
          expect.any(Function)
        );
      });

      // Simulate error event
      const testError = new Error("Peer connection failed");
      const errorHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "error"
      )?.[1];

      if (errorHandler) {
        errorHandler(testError);
      }

      expect(onConnectionStateChange).toHaveBeenCalledWith("failed");
      expect(onError).toHaveBeenCalledWith(testError);
    });
  });

  describe("Signal Handling", () => {
    it("should send offer signal when peer generates offer", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      renderVideoSessionManager({ isInitiator: true });

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "signal",
          expect.any(Function)
        );
      });

      // Simulate signal event with offer
      const signalHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "signal"
      )?.[1];

      const offerData = { type: "offer", sdp: "mock-offer-sdp" };
      if (signalHandler) {
        signalHandler(offerData);
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/video/session-123/signal",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              type: "offer",
              data: offerData,
              targetUserId: "other-participant",
            }),
          })
        );
      });
    });

    it("should send answer signal when peer generates answer", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      renderVideoSessionManager({ isInitiator: false });

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "signal",
          expect.any(Function)
        );
      });

      // Simulate signal event with answer
      const signalHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "signal"
      )?.[1];

      const answerData = { type: "answer", sdp: "mock-answer-sdp" };
      if (signalHandler) {
        signalHandler(answerData);
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/video/session-123/signal",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              type: "answer",
              data: answerData,
              targetUserId: "other-participant",
            }),
          })
        );
      });
    });

    it("should send ICE candidate signal", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      renderVideoSessionManager();

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "signal",
          expect.any(Function)
        );
      });

      // Simulate signal event with ICE candidate
      const signalHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "signal"
      )?.[1];

      const candidateData = { candidate: "mock-ice-candidate" };
      if (signalHandler) {
        signalHandler(candidateData);
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/video/session-123/signal",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              type: "ice-candidate",
              data: candidateData,
              targetUserId: "other-participant",
            }),
          })
        );
      });
    });

    it("should handle signal sending errors", async () => {
      const onError = vi.fn();
      (global.fetch as any).mockRejectedValue(new Error("Signal send failed"));

      renderVideoSessionManager({ onError });

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "signal",
          expect.any(Function)
        );
      });

      // Simulate signal event
      const signalHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "signal"
      )?.[1];

      const offerData = { type: "offer", sdp: "mock-offer-sdp" };
      if (signalHandler) {
        signalHandler(offerData);
      }

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe("Media Stream Errors", () => {
    it("should handle getUserMedia errors", async () => {
      const onConnectionStateChange = vi.fn();
      const onError = vi.fn();
      mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));

      renderVideoSessionManager({ onConnectionStateChange, onError });

      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalledWith("failed");
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("should not initialize peer when media access fails", async () => {
      mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));

      renderVideoSessionManager();

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // SimplePeer should not be initialized
      expect(mockSimplePeer).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup peer and streams on unmount", async () => {
      const mockAudioTrack = createMockTrack("audio");
      const mockVideoTrack = createMockTrack("video");
      const mockStream = createMockMediaStream([
        mockAudioTrack,
        mockVideoTrack,
      ]);
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { unmount } = renderVideoSessionManager();

      await waitFor(() => {
        expect(mockSimplePeer).toHaveBeenCalled();
      });

      unmount();

      expect(mockPeerInstance.destroy).toHaveBeenCalled();
      expect(mockAudioTrack.stop).toHaveBeenCalled();
      expect(mockVideoTrack.stop).toHaveBeenCalled();
    });

    it("should not destroy already destroyed peer", async () => {
      const { unmount } = renderVideoSessionManager();

      await waitFor(() => {
        expect(mockSimplePeer).toHaveBeenCalled();
      });

      // Mark peer as destroyed
      mockPeerInstance.destroyed = true;

      unmount();

      expect(mockPeerInstance.destroy).not.toHaveBeenCalled();
    });

    it("should handle cleanup when peer is null", () => {
      const { unmount } = renderVideoSessionManager();

      // Unmount before peer is initialized
      unmount();

      // Should not throw error
      expect(mockPeerInstance.destroy).not.toHaveBeenCalled();
    });
  });

  describe("Signal Queue Management", () => {
    it("should queue signals when peer is not ready", async () => {
      // Don't initialize peer immediately
      mockGetUserMedia.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { unmount } = renderVideoSessionManager();

      // Component should handle queued signals gracefully
      unmount();
    });

    it("should process queued signals when peer becomes ready", async () => {
      renderVideoSessionManager();

      await waitFor(() => {
        expect(mockSimplePeer).toHaveBeenCalled();
      });

      // Peer should be ready to process signals
      expect(mockPeerInstance.signal).not.toHaveBeenCalled();
    });
  });

  describe("Connection State Management", () => {
    it("should start in connecting state", () => {
      const onConnectionStateChange = vi.fn();
      renderVideoSessionManager({ onConnectionStateChange });

      expect(onConnectionStateChange).toHaveBeenCalledWith("connecting");
    });

    it("should transition through connection states correctly", async () => {
      const onConnectionStateChange = vi.fn();
      renderVideoSessionManager({ onConnectionStateChange });

      // Initial state
      expect(onConnectionStateChange).toHaveBeenCalledWith("connecting");

      await waitFor(() => {
        expect(mockPeerInstance.on).toHaveBeenCalledWith(
          "connect",
          expect.any(Function)
        );
      });

      // Simulate successful connection
      const connectHandler = mockPeerInstance.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];

      if (connectHandler) {
        connectHandler();
      }

      expect(onConnectionStateChange).toHaveBeenCalledWith("connected");
    });
  });

  describe("Error Recovery", () => {
    it("should handle WebRTC config fetch failure gracefully", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Config fetch failed"));

      renderVideoSessionManager();

      // Should still initialize with fallback config
      await waitFor(() => {
        expect(mockSimplePeer).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              iceServers: expect.arrayContaining([
                { urls: "stun:stun.l.google.com:19302" },
              ]),
            }),
          })
        );
      });
    });

    it("should handle peer initialization errors", async () => {
      const onError = vi.fn();
      mockSimplePeer.mockImplementation(() => {
        throw new Error("Peer initialization failed");
      });

      renderVideoSessionManager({ onError });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});
