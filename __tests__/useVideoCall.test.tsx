import { useVideoCall } from "@/hooks/useVideoCall";
import { WebRTCCompatibility } from "@/lib/video-call-errors";
import { VideoCallService } from "@/lib/video-call/video-call-service";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

// Mock dependencies
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/lib/video-call-service");
vi.mock("@/lib/video-call-errors");

const mockVideoCallService = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  destroy: vi.fn(),
  startCall: vi.fn(),
  answerCall: vi.fn(),
  endCall: vi.fn(),
  toggleCamera: vi.fn(),
  toggleMicrophone: vi.fn(),
  getMediaStreamState: vi.fn(() => ({
    localStream: null,
    remoteStream: null,
    isCameraEnabled: true,
    isMicrophoneEnabled: true,
  })),
};

describe("useVideoCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (VideoCallService as Mock).mockImplementation(() => mockVideoCallService);
    (WebRTCCompatibility.isSupported as Mock).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useVideoCall());

    expect(result.current.currentCall).toBeNull();
    expect(result.current.isInCall).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.incomingCall).toBeNull();
    expect(result.current.callStatus).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isWebRTCSupported).toBe(true);
  });

  it("should detect WebRTC not supported", () => {
    (WebRTCCompatibility.isSupported as Mock).mockReturnValue(false);

    const { result } = renderHook(() => useVideoCall());

    expect(result.current.isWebRTCSupported).toBe(false);
    expect(result.current.error).toBeDefined();
  });

  it("should initialize video call service when user is available", async () => {
    renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(VideoCallService).toHaveBeenCalledWith(
        expect.any(Object),
        "test-user-id"
      );
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });
  });

  it("should handle call_created event", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    const eventHandler = mockVideoCallService.addEventListener.mock.calls[0][0];
    const mockCall = {
      id: "test-call-id",
      room_id: "test-room-id",
      caller_id: "test-user-id",
      receiver_id: "test-receiver-id",
      status: "calling" as const,
      call_type: "video" as const,
      started_at: new Date().toISOString(),
    };

    act(() => {
      eventHandler({ type: "call_created", call: mockCall });
    });

    expect(result.current.currentCall).toEqual(mockCall);
    expect(result.current.isInCall).toBe(true);
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.callStatus).toBe("calling");
  });

  it("should handle incoming_call event", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    const eventHandler = mockVideoCallService.addEventListener.mock.calls[0][0];
    const mockCall = {
      id: "test-call-id",
      room_id: "test-room-id",
      caller_id: "test-caller-id",
      receiver_id: "test-user-id",
      status: "calling" as const,
      call_type: "video" as const,
      started_at: new Date().toISOString(),
    };

    act(() => {
      eventHandler({ type: "incoming_call", call: mockCall });
    });

    expect(result.current.incomingCall).toEqual(mockCall);
  });

  it("should handle connection_state_changed event", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    const eventHandler = mockVideoCallService.addEventListener.mock.calls[0][0];

    act(() => {
      eventHandler({ type: "connection_state_changed", state: "connected" });
    });

    expect(result.current.connectionState).toBe("connected");
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.callStatus).toBe("active");
  });

  it("should handle remote_stream_added event", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    const eventHandler = mockVideoCallService.addEventListener.mock.calls[0][0];
    const mockStream = new MediaStream();

    // Mock video element
    const mockVideoElement = {
      srcObject: null,
    };
    result.current.remoteVideoRef.current = mockVideoElement as any;

    act(() => {
      eventHandler({ type: "remote_stream_added", stream: mockStream });
    });

    expect(result.current.mediaState.remoteStream).toBe(mockStream);
    expect(mockVideoElement.srcObject).toBe(mockStream);
  });

  it("should handle error event", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    const eventHandler = mockVideoCallService.addEventListener.mock.calls[0][0];
    const mockError = new Error("Test error");

    act(() => {
      eventHandler({ type: "error", error: mockError });
    });

    expect(result.current.error).toBe(mockError);
    expect(result.current.isConnecting).toBe(false);
  });

  it("should start a call", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.startCall(
        "test-room-id",
        "test-receiver-id",
        "video"
      );
    });

    expect(mockVideoCallService.startCall).toHaveBeenCalledWith(
      "test-room-id",
      "test-receiver-id",
      "video"
    );
  });

  it("should handle start call error", async () => {
    const { result } = renderHook(() => useVideoCall());
    const mockError = new Error("Start call failed");
    mockVideoCallService.startCall.mockRejectedValue(mockError);

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    await act(async () => {
      try {
        await result.current.startCall("test-room-id", "test-receiver-id");
      } catch (error) {
        expect(error).toBe(mockError);
      }
    });

    expect(result.current.error).toBe(mockError);
  });

  it("should answer a call", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    // Set incoming call
    const mockCall = {
      id: "test-call-id",
      room_id: "test-room-id",
      caller_id: "test-caller-id",
      receiver_id: "test-user-id",
      status: "calling" as const,
      call_type: "video" as const,
      started_at: new Date().toISOString(),
    };

    const eventHandler = mockVideoCallService.addEventListener.mock.calls[0][0];
    act(() => {
      eventHandler({ type: "incoming_call", call: mockCall });
    });

    await act(async () => {
      await result.current.answerCall("test-call-id", true);
    });

    expect(mockVideoCallService.answerCall).toHaveBeenCalledWith(
      "test-call-id",
      true
    );
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.isInCall).toBe(true);
    expect(result.current.incomingCall).toBeNull();
  });

  it("should decline a call", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.answerCall("test-call-id", false);
    });

    expect(mockVideoCallService.answerCall).toHaveBeenCalledWith(
      "test-call-id",
      false
    );
  });

  it("should end a call", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    // Set up active call state
    act(() => {
      result.current.currentCall = {
        id: "test-call-id",
        room_id: "test-room-id",
        caller_id: "test-user-id",
        receiver_id: "test-receiver-id",
        status: "active",
        call_type: "video",
        started_at: new Date().toISOString(),
      } as any;
    });

    await act(async () => {
      await result.current.endCall("user_ended");
    });

    expect(mockVideoCallService.endCall).toHaveBeenCalledWith("user_ended");
  });

  it("should toggle camera", async () => {
    const { result } = renderHook(() => useVideoCall());
    mockVideoCallService.toggleCamera.mockReturnValue(false);

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    act(() => {
      const enabled = result.current.toggleCamera();
      expect(enabled).toBe(false);
    });

    expect(mockVideoCallService.toggleCamera).toHaveBeenCalled();
  });

  it("should toggle microphone", async () => {
    const { result } = renderHook(() => useVideoCall());
    mockVideoCallService.toggleMicrophone.mockReturnValue(false);

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    act(() => {
      const enabled = result.current.toggleMicrophone();
      expect(enabled).toBe(false);
    });

    expect(mockVideoCallService.toggleMicrophone).toHaveBeenCalled();
  });

  it("should clear error", () => {
    const { result } = renderHook(() => useVideoCall());

    // Set error
    act(() => {
      result.current.error = new Error("Test error") as any;
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("should dismiss incoming call", async () => {
    const { result } = renderHook(() => useVideoCall());

    await waitFor(() => {
      expect(mockVideoCallService.addEventListener).toHaveBeenCalled();
    });

    // Set incoming call
    const eventHandler = mockVideoCallService.addEventListener.mock.calls[0][0];
    act(() => {
      eventHandler({
        type: "incoming_call",
        call: {
          id: "test-call-id",
          room_id: "test-room-id",
          caller_id: "test-caller-id",
          receiver_id: "test-user-id",
          status: "calling",
          call_type: "video",
          started_at: new Date().toISOString(),
        },
      });
    });

    expect(result.current.incomingCall).toBeDefined();

    act(() => {
      result.current.dismissIncomingCall();
    });

    expect(result.current.incomingCall).toBeNull();
  });

  it("should clean up on unmount", () => {
    const { unmount } = renderHook(() => useVideoCall());

    unmount();

    expect(mockVideoCallService.removeEventListener).toHaveBeenCalled();
    expect(mockVideoCallService.destroy).toHaveBeenCalled();
  });

  it("should prevent initialization without WebRTC support", () => {
    (WebRTCCompatibility.isSupported as Mock).mockReturnValue(false);

    renderHook(() => useVideoCall());

    expect(VideoCallService).not.toHaveBeenCalled();
  });

  it("should handle service initialization failure gracefully", () => {
    (VideoCallService as Mock).mockImplementation(() => {
      throw new Error("Service initialization failed");
    });

    expect(() => renderHook(() => useVideoCall())).not.toThrow();
  });
});
