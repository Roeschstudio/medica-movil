import { VideoCallSecurity } from "@/lib/video-call/video-call-security";
import { VideoCallEvent, VideoCallService } from "@/lib/video-call/video-call-service";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ order: vi.fn(() => ({ data: [], error: null })) })),
    })),
  })),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({ subscribe: vi.fn() })),
  })),
  removeChannel: vi.fn(),
};

// Mock WebRTC APIs
const mockRTCPeerConnection = vi.fn(() => ({
  createOffer: vi.fn(() => Promise.resolve({ type: "offer", sdp: "mock-sdp" })),
  createAnswer: vi.fn(() =>
    Promise.resolve({ type: "answer", sdp: "mock-sdp" })
  ),
  setLocalDescription: vi.fn(() => Promise.resolve()),
  setRemoteDescription: vi.fn(() => Promise.resolve()),
  addIceCandidate: vi.fn(() => Promise.resolve()),
  addTrack: vi.fn(),
  close: vi.fn(),
  connectionState: "new" as RTCPeerConnectionState,
  onconnectionstatechange: null,
  onicecandidate: null,
  ontrack: null,
}));

const mockGetUserMedia = vi.fn(() =>
  Promise.resolve({
    getTracks: () => [
      { kind: "video", enabled: true, stop: vi.fn() },
      { kind: "audio", enabled: true, stop: vi.fn() },
    ],
    getVideoTracks: () => [{ enabled: true, stop: vi.fn() }],
    getAudioTracks: () => [{ enabled: true, stop: vi.fn() }],
  })
);

// Setup global mocks
Object.defineProperty(global, "RTCPeerConnection", {
  writable: true,
  value: mockRTCPeerConnection,
});

Object.defineProperty(global, "navigator", {
  writable: true,
  value: {
    mediaDevices: {
      getUserMedia: mockGetUserMedia,
    },
  },
});

// Mock VideoCallSecurity
vi.mock("@/lib/video-call-security", () => ({
  VideoCallSecurity: {
    checkRateLimit: vi.fn(() => true),
    validateSecureContext: vi.fn(() => ({ isSecure: true })),
    validateSignalData: vi.fn(() => true),
    validateSession: vi.fn(() => true),
    updateSessionActivity: vi.fn(),
    createSession: vi.fn(),
    endSession: vi.fn(),
    sanitizeCallMetadata: vi.fn((data) => data),
  },
}));

describe("VideoCallService", () => {
  let videoCallService: VideoCallService;
  let eventListener: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    videoCallService = new VideoCallService(mockSupabase, "test-user-id");
    eventListener = vi.fn();
    videoCallService.addEventListener(eventListener);
  });

  afterEach(() => {
    videoCallService.destroy();
  });

  describe("WebRTC Support Detection", () => {
    it("should detect WebRTC support correctly", () => {
      expect(VideoCallService.isWebRTCSupported()).toBe(true);
    });

    it("should return false when WebRTC is not supported", () => {
      // @ts-ignore
      global.RTCPeerConnection = undefined;
      expect(VideoCallService.isWebRTCSupported()).toBe(false);

      // Restore for other tests
      global.RTCPeerConnection = mockRTCPeerConnection;
    });
  });

  describe("Media Stream Management", () => {
    it("should acquire media stream successfully", async () => {
      const stream = await videoCallService.acquireMediaStream();

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: true,
        audio: true,
      });
      expect(stream).toBeDefined();
      expect(videoCallService.getLocalStream()).toBe(stream);
    });

    it("should handle media access denied error", async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error("Permission denied"));

      await expect(videoCallService.acquireMediaStream()).rejects.toThrow(
        "Failed to acquire media stream"
      );
      expect(eventListener).toHaveBeenCalledWith({
        type: "error",
        error: expect.any(Error),
      });
    });

    it("should toggle camera on/off", async () => {
      await videoCallService.acquireMediaStream();

      const enabled = videoCallService.toggleCamera();
      expect(enabled).toBe(false); // Should toggle to false

      const mediaState = videoCallService.getMediaStreamState();
      expect(mediaState.isCameraEnabled).toBe(false);
    });

    it("should toggle microphone on/off", async () => {
      await videoCallService.acquireMediaStream();

      const enabled = videoCallService.toggleMicrophone();
      expect(enabled).toBe(false); // Should toggle to false

      const mediaState = videoCallService.getMediaStreamState();
      expect(mediaState.isMicrophoneEnabled).toBe(false);
    });
  });

  describe("WebRTC Peer Connection", () => {
    it("should create WebRTC offer", async () => {
      const peerConnection = videoCallService["setupPeerConnection"]();
      await videoCallService.acquireMediaStream();
      videoCallService.addLocalStreamToPeerConnection();

      const offer = await videoCallService.createOffer();

      expect(offer).toEqual({ type: "offer", sdp: "mock-sdp" });
      expect(peerConnection.createOffer).toHaveBeenCalled();
      expect(peerConnection.setLocalDescription).toHaveBeenCalledWith(offer);
    });

    it("should create WebRTC answer", async () => {
      const peerConnection = videoCallService["setupPeerConnection"]();
      const mockOffer = { type: "offer", sdp: "mock-offer-sdp" };

      const answer = await videoCallService.createAnswer(mockOffer);

      expect(answer).toEqual({ type: "answer", sdp: "mock-sdp" });
      expect(peerConnection.setRemoteDescription).toHaveBeenCalledWith(
        mockOffer
      );
      expect(peerConnection.createAnswer).toHaveBeenCalled();
      expect(peerConnection.setLocalDescription).toHaveBeenCalledWith(answer);
    });

    it("should handle ICE candidates", async () => {
      const peerConnection = videoCallService["setupPeerConnection"]();
      const candidateData = {
        candidate: "candidate:1 1 UDP 2130706431 192.168.1.1 54400 typ host",
        sdpMLineIndex: 0,
        sdpMid: "0",
      };

      await videoCallService.handleIceCandidate(candidateData);

      expect(peerConnection.addIceCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          candidate: candidateData.candidate,
          sdpMLineIndex: candidateData.sdpMLineIndex,
          sdpMid: candidateData.sdpMid,
        })
      );
    });
  });

  describe("Call Lifecycle Management", () => {
    beforeEach(() => {
      // Mock successful database operations
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: "test-call-id",
                room_id: "test-room-id",
                caller_id: "test-user-id",
                receiver_id: "test-receiver-id",
                status: "calling",
                call_type: "video",
                started_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ data: {}, error: null })),
            })),
          })),
        })),
      });
    });

    it("should start a video call successfully", async () => {
      const call = await videoCallService.startCall(
        "test-room-id",
        "test-receiver-id"
      );

      expect(call).toBeDefined();
      expect(call.id).toBe("test-call-id");
      expect(call.status).toBe("calling");
      expect(VideoCallSecurity.checkRateLimit).toHaveBeenCalledWith(
        "test-user-id",
        "start_call"
      );
      expect(VideoCallSecurity.createSession).toHaveBeenCalledWith(
        "test-call-id",
        "test-user-id"
      );
    });

    it("should handle rate limiting for call initiation", async () => {
      (VideoCallSecurity.checkRateLimit as Mock).mockReturnValueOnce(false);

      await expect(
        videoCallService.startCall("test-room-id", "test-receiver-id")
      ).rejects.toThrow("Rate limit exceeded for call initiation");
    });

    it("should answer a call successfully", async () => {
      const mockCall = {
        id: "test-call-id",
        room_id: "test-room-id",
        caller_id: "test-caller-id",
        receiver_id: "test-user-id",
        status: "calling" as const,
        call_type: "video" as const,
        started_at: new Date().toISOString(),
      };

      videoCallService.setCurrentCall(mockCall);

      await videoCallService.answerCall("test-call-id", true);

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: "ringing",
        answered_at: expect.any(String),
      });
    });

    it("should decline a call", async () => {
      await videoCallService.answerCall("test-call-id", false);

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: "declined",
        ended_at: expect.any(String),
      });
    });

    it("should end a call successfully", async () => {
      const mockCall = {
        id: "test-call-id",
        room_id: "test-room-id",
        caller_id: "test-user-id",
        receiver_id: "test-receiver-id",
        status: "active" as const,
        call_type: "video" as const,
        started_at: new Date().toISOString(),
        answered_at: new Date().toISOString(),
      };

      videoCallService.setCurrentCall(mockCall);

      await videoCallService.endCall("user_ended");

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: "ended",
        ended_at: expect.any(String),
        duration_seconds: expect.any(Number),
        end_reason: "user_ended",
      });
      expect(VideoCallSecurity.endSession).toHaveBeenCalledWith("test-call-id");
    });
  });

  describe("Signaling", () => {
    beforeEach(() => {
      const mockCall = {
        id: "test-call-id",
        room_id: "test-room-id",
        caller_id: "test-user-id",
        receiver_id: "test-receiver-id",
        status: "active" as const,
        call_type: "video" as const,
        started_at: new Date().toISOString(),
      };

      videoCallService.setCurrentCall(mockCall);

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({ error: null })),
      });
    });

    it("should send WebRTC signals", async () => {
      const signalData = { type: "offer", sdp: "mock-sdp" };

      await videoCallService["sendSignal"]("offer", signalData);

      expect(VideoCallSecurity.checkRateLimit).toHaveBeenCalledWith(
        "test-user-id",
        "signal"
      );
      expect(VideoCallSecurity.validateSignalData).toHaveBeenCalledWith(
        "offer",
        signalData
      );
      expect(VideoCallSecurity.validateSession).toHaveBeenCalledWith(
        "test-call-id",
        "test-user-id"
      );
      expect(VideoCallSecurity.updateSessionActivity).toHaveBeenCalledWith(
        "test-call-id"
      );
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    it("should handle signal rate limiting", async () => {
      (VideoCallSecurity.checkRateLimit as Mock).mockReturnValueOnce(false);

      await expect(videoCallService["sendSignal"]("offer", {})).rejects.toThrow(
        "Rate limit exceeded for signaling"
      );
    });

    it("should validate signal data", async () => {
      (VideoCallSecurity.validateSignalData as Mock).mockReturnValueOnce(false);

      await expect(videoCallService["sendSignal"]("offer", {})).rejects.toThrow(
        "Invalid signal data"
      );
    });
  });

  describe("Event Handling", () => {
    it("should emit events to listeners", () => {
      const testEvent: VideoCallEvent = {
        type: "error",
        error: new Error("Test error"),
      };

      videoCallService["emit"](testEvent);

      expect(eventListener).toHaveBeenCalledWith(testEvent);
    });

    it("should handle listener errors gracefully", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });

      videoCallService.addEventListener(errorListener);

      // Should not throw
      expect(() => {
        videoCallService["emit"]({ type: "error", error: new Error("Test") });
      }).not.toThrow();
    });

    it("should remove event listeners", () => {
      videoCallService.removeEventListener(eventListener);

      videoCallService["emit"]({ type: "error", error: new Error("Test") });

      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should clean up resources properly", async () => {
      await videoCallService.acquireMediaStream();
      const localStream = videoCallService.getLocalStream();
      const tracks = localStream?.getTracks() || [];

      videoCallService.cleanup();

      tracks.forEach((track) => {
        expect(track.stop).toHaveBeenCalled();
      });

      expect(videoCallService.getLocalStream()).toBeNull();
      expect(videoCallService.getRemoteStream()).toBeNull();
    });

    it("should destroy service and clean up subscriptions", () => {
      videoCallService.destroy();

      expect(mockSupabase.removeChannel).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle peer connection setup errors", () => {
      mockRTCPeerConnection.mockImplementationOnce(() => {
        throw new Error("WebRTC not supported");
      });

      expect(() => videoCallService["setupPeerConnection"]()).toThrow(
        "WebRTC not supported"
      );
    });

    it("should handle offer creation errors", async () => {
      const peerConnection = videoCallService["setupPeerConnection"]();
      peerConnection.createOffer.mockRejectedValueOnce(
        new Error("Offer creation failed")
      );

      await expect(videoCallService.createOffer()).rejects.toThrow(
        "Failed to create offer"
      );
      expect(eventListener).toHaveBeenCalledWith({
        type: "error",
        error: expect.any(Error),
      });
    });

    it("should handle answer creation errors", async () => {
      const peerConnection = videoCallService["setupPeerConnection"]();
      peerConnection.createAnswer.mockRejectedValueOnce(
        new Error("Answer creation failed")
      );

      const mockOffer = { type: "offer", sdp: "mock-sdp" };
      await expect(videoCallService.createAnswer(mockOffer)).rejects.toThrow(
        "Failed to create answer"
      );
      expect(eventListener).toHaveBeenCalledWith({
        type: "error",
        error: expect.any(Error),
      });
    });
  });
});
