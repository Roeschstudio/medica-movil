import { VideoCallSecurity } from "@/lib/video-call/video-call-security";
import { VideoCallService } from "@/lib/video-call/video-call-service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase with more realistic behavior
const createMockSupabase = () => {
  const mockData = {
    videoCalls: new Map(),
    signals: new Map(),
    chatRooms: new Map(),
    appointments: new Map(),
  };

  return {
    from: (table: string) => ({
      insert: vi.fn((data) => {
        const id = `${table}-${Date.now()}-${Math.random()}`;
        const record = { ...data, id, created_at: new Date().toISOString() };
        mockData[table as keyof typeof mockData]?.set(id, record);
        return {
          select: () => ({
            single: () => ({ data: record, error: null }),
          }),
        };
      }),
      update: vi.fn((updates) => ({
        eq: (field: string, value: string) => ({
          select: () => ({
            single: () => {
              const existing = Array.from(
                mockData[table as keyof typeof mockData]?.values() || []
              ).find((item: any) => item[field] === value);
              if (existing) {
                Object.assign(existing, updates);
                return { data: existing, error: null };
              }
              return { data: null, error: { message: "Record not found" } };
            },
          }),
        }),
      })),
      select: vi.fn(() => ({
        eq: () => ({
          order: () => ({ data: [], error: null }),
          single: () => ({ data: null, error: null }),
        }),
        or: () => ({
          in: () => ({
            limit: () => ({ data: [], error: null }),
          }),
        }),
      })),
    }),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
    })),
    removeChannel: vi.fn(),
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: "test-user-id" } },
        error: null,
      })),
    },
  };
};

// Mock WebRTC APIs with more realistic behavior
const createMockPeerConnection = () => {
  const mockPC = {
    localDescription: null as RTCSessionDescription | null,
    remoteDescription: null as RTCSessionDescription | null,
    connectionState: "new" as RTCPeerConnectionState,
    iceConnectionState: "new" as RTCIceConnectionState,
    onconnectionstatechange: null as ((event: Event) => void) | null,
    onicecandidate: null as ((event: RTCPeerConnectionIceEvent) => void) | null,
    ontrack: null as ((event: RTCTrackEvent) => void) | null,

    createOffer: vi.fn(() =>
      Promise.resolve({
        type: "offer" as RTCSdpType,
        sdp: "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n...",
      })
    ),

    createAnswer: vi.fn(() =>
      Promise.resolve({
        type: "answer" as RTCSdpType,
        sdp: "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n...",
      })
    ),

    setLocalDescription: vi.fn((desc) => {
      mockPC.localDescription = desc;
      return Promise.resolve();
    }),

    setRemoteDescription: vi.fn((desc) => {
      mockPC.remoteDescription = desc;
      return Promise.resolve();
    }),

    addIceCandidate: vi.fn(() => Promise.resolve()),
    addTrack: vi.fn(),
    close: vi.fn(),

    // Simulate connection state changes
    simulateConnectionStateChange: (state: RTCPeerConnectionState) => {
      mockPC.connectionState = state;
      if (mockPC.onconnectionstatechange) {
        mockPC.onconnectionstatechange(new Event("connectionstatechange"));
      }
    },

    // Simulate ICE candidate
    simulateIceCandidate: (candidate: string) => {
      if (mockPC.onicecandidate) {
        const event = {
          candidate: {
            candidate,
            sdpMLineIndex: 0,
            sdpMid: "0",
          },
        } as RTCPeerConnectionIceEvent;
        mockPC.onicecandidate(event);
      }
    },

    // Simulate remote track
    simulateRemoteTrack: (stream: MediaStream) => {
      if (mockPC.ontrack) {
        const event = {
          streams: [stream],
          track: stream.getTracks()[0],
        } as RTCTrackEvent;
        mockPC.ontrack(event);
      }
    },
  };

  return mockPC;
};

const createMockMediaStream = () => {
  const tracks = [
    {
      kind: "video",
      enabled: true,
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    {
      kind: "audio",
      enabled: true,
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  ];

  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
  } as unknown as MediaStream;
};

describe("Video Call Integration Tests", () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockPeerConnection: ReturnType<typeof createMockPeerConnection>;
  let callerService: VideoCallService;
  let receiverService: VideoCallService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = createMockSupabase();
    mockPeerConnection = createMockPeerConnection();

    // Setup global mocks
    global.RTCPeerConnection = vi.fn(() => mockPeerConnection) as any;
    global.navigator = {
      mediaDevices: {
        getUserMedia: vi.fn(() => Promise.resolve(createMockMediaStream())),
      },
    } as any;

    // Mock VideoCallSecurity
    vi.mocked(VideoCallSecurity.checkRateLimit).mockReturnValue(true);
    vi.mocked(VideoCallSecurity.validateSecureContext).mockReturnValue({
      isSecure: true,
    });
    vi.mocked(VideoCallSecurity.validateSignalData).mockReturnValue(true);
    vi.mocked(VideoCallSecurity.validateSession).mockReturnValue(true);
    vi.mocked(VideoCallSecurity.sanitizeCallMetadata).mockImplementation(
      (data) => data
    );

    // Initialize services
    callerService = new VideoCallService(mockSupabase, "caller-user-id");
    receiverService = new VideoCallService(mockSupabase, "receiver-user-id");
  });

  afterEach(() => {
    callerService.destroy();
    receiverService.destroy();
  });

  describe("Complete Call Flow", () => {
    it("should complete a full video call workflow", async () => {
      const events: any[] = [];

      // Setup event listeners
      callerService.addEventListener((event) =>
        events.push({ source: "caller", ...event })
      );
      receiverService.addEventListener((event) =>
        events.push({ source: "receiver", ...event })
      );

      // Step 1: Caller starts a call
      const call = await callerService.startCall(
        "test-room-id",
        "receiver-user-id",
        "video"
      );

      expect(call).toBeDefined();
      expect(call.status).toBe("calling");
      expect(events).toContainEqual({
        source: "caller",
        type: "call_created",
        call: expect.objectContaining({ status: "calling" }),
      });

      // Step 2: Simulate receiver getting the call
      receiverService["handleIncomingCall"](call);

      // Step 3: Receiver answers the call
      await receiverService.answerCall(call.id, true);

      // Step 4: Simulate WebRTC signaling exchange
      const offer = await callerService.createOffer();
      await receiverService["handleIncomingSignal"]({
        id: "signal-1",
        call_id: call.id,
        sender_id: "caller-user-id",
        receiver_id: "receiver-user-id",
        signal_type: "offer",
        signal_data: offer,
        created_at: new Date().toISOString(),
      });

      const answer = await receiverService.createAnswer(offer);
      await callerService["handleIncomingSignal"]({
        id: "signal-2",
        call_id: call.id,
        sender_id: "receiver-user-id",
        receiver_id: "caller-user-id",
        signal_type: "answer",
        signal_data: answer,
        created_at: new Date().toISOString(),
      });

      // Step 5: Simulate ICE candidate exchange
      const candidateData = {
        candidate: "candidate:1 1 UDP 2130706431 192.168.1.1 54400 typ host",
        sdpMLineIndex: 0,
        sdpMid: "0",
      };

      await callerService.handleIceCandidate(candidateData);
      await receiverService.handleIceCandidate(candidateData);

      // Step 6: Simulate connection establishment
      mockPeerConnection.simulateConnectionStateChange("connected");

      // Step 7: Simulate media stream
      const remoteStream = createMockMediaStream();
      mockPeerConnection.simulateRemoteTrack(remoteStream);

      // Step 8: End the call
      await callerService.endCall("user_ended");

      // Verify the complete flow
      expect(events).toContainEqual({
        source: "caller",
        type: "connection_state_changed",
        state: "connected",
      });

      expect(events).toContainEqual({
        source: "caller",
        type: "remote_stream_added",
        stream: remoteStream,
      });
    });

    it("should handle call rejection", async () => {
      const events: any[] = [];
      callerService.addEventListener((event) =>
        events.push({ source: "caller", ...event })
      );

      // Start call
      const call = await callerService.startCall(
        "test-room-id",
        "receiver-user-id"
      );

      // Receiver declines
      await receiverService.answerCall(call.id, false);

      // Verify call was declined
      expect(mockSupabase.from).toHaveBeenCalledWith("video_calls");
      const updateCall = mockSupabase.from("video_calls").update;
      expect(updateCall).toHaveBeenCalledWith({
        status: "declined",
        ended_at: expect.any(String),
      });
    });

    it("should handle connection failures", async () => {
      const events: any[] = [];
      callerService.addEventListener((event) => events.push(event));

      // Start call
      await callerService.startCall("test-room-id", "receiver-user-id");

      // Simulate connection failure
      mockPeerConnection.simulateConnectionStateChange("failed");

      // Verify error handling
      expect(events).toContainEqual({
        type: "connection_state_changed",
        state: "failed",
      });
    });
  });

  describe("Media Stream Management", () => {
    it("should handle media stream acquisition and control", async () => {
      // Start call to acquire media
      await callerService.startCall("test-room-id", "receiver-user-id");

      // Verify media stream was acquired
      const localStream = callerService.getLocalStream();
      expect(localStream).toBeDefined();

      // Test camera toggle
      const cameraEnabled = callerService.toggleCamera();
      expect(typeof cameraEnabled).toBe("boolean");

      // Test microphone toggle
      const micEnabled = callerService.toggleMicrophone();
      expect(typeof micEnabled).toBe("boolean");

      // Verify media state
      const mediaState = callerService.getMediaStreamState();
      expect(mediaState).toHaveProperty("isCameraEnabled");
      expect(mediaState).toHaveProperty("isMicrophoneEnabled");
    });

    it("should handle media access denied", async () => {
      // Mock media access denied
      global.navigator.mediaDevices.getUserMedia = vi.fn(() =>
        Promise.reject(new Error("Permission denied"))
      );

      const events: any[] = [];
      callerService.addEventListener((event) => events.push(event));

      // Attempt to start call
      await expect(
        callerService.startCall("test-room-id", "receiver-user-id")
      ).rejects.toThrow();

      // Verify error was emitted
      expect(events).toContainEqual({
        type: "error",
        error: expect.any(Error),
      });
    });
  });

  describe("Security Integration", () => {
    it("should enforce rate limiting", async () => {
      vi.mocked(VideoCallSecurity.checkRateLimit).mockReturnValue(false);

      await expect(
        callerService.startCall("test-room-id", "receiver-user-id")
      ).rejects.toThrow("Rate limit exceeded");
    });

    it("should validate secure context", async () => {
      vi.mocked(VideoCallSecurity.validateSecureContext).mockReturnValue({
        isSecure: false,
        message: "HTTPS required",
      });

      await expect(
        callerService.startCall("test-room-id", "receiver-user-id")
      ).rejects.toThrow("HTTPS required");
    });

    it("should validate signal data", async () => {
      vi.mocked(VideoCallSecurity.validateSignalData).mockReturnValue(false);

      // Start call first
      const call = await callerService.startCall(
        "test-room-id",
        "receiver-user-id"
      );
      callerService.setCurrentCall(call);

      // Try to send invalid signal
      await expect(callerService["sendSignal"]("offer", {})).rejects.toThrow(
        "Invalid signal data"
      );
    });

    it("should validate session", async () => {
      vi.mocked(VideoCallSecurity.validateSession).mockReturnValue(false);

      // Start call first
      const call = await callerService.startCall(
        "test-room-id",
        "receiver-user-id"
      );
      callerService.setCurrentCall(call);

      // Try to send signal with invalid session
      await expect(
        callerService["sendSignal"]("offer", { type: "offer", sdp: "test" })
      ).rejects.toThrow("Invalid or expired session");
    });
  });

  describe("Database Integration", () => {
    it("should create and update video call records", async () => {
      const call = await callerService.startCall(
        "test-room-id",
        "receiver-user-id"
      );

      // Verify call creation
      expect(mockSupabase.from).toHaveBeenCalledWith("video_calls");
      expect(call).toMatchObject({
        room_id: "test-room-id",
        caller_id: "caller-user-id",
        receiver_id: "receiver-user-id",
        status: "calling",
        call_type: "video",
      });

      // Update call status
      const updatedCall = await callerService.updateVideoCall(call.id, {
        status: "active",
      });
      expect(updatedCall.status).toBe("active");
    });

    it("should store WebRTC signals", async () => {
      const call = await callerService.startCall(
        "test-room-id",
        "receiver-user-id"
      );
      callerService.setCurrentCall(call);

      const signalData = { type: "offer", sdp: "test-sdp" };
      await callerService["sendSignal"]("offer", signalData);

      expect(mockSupabase.from).toHaveBeenCalledWith("webrtc_signals");
    });

    it("should handle database errors gracefully", async () => {
      // Mock database error
      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { message: "Database error" },
            })),
          })),
        })),
      }));

      await expect(
        callerService.startCall("test-room-id", "receiver-user-id")
      ).rejects.toThrow("Failed to create video call");
    });
  });

  describe("Real-time Subscriptions", () => {
    it("should setup real-time subscriptions", () => {
      expect(mockSupabase.channel).toHaveBeenCalledWith("video_calls");
      expect(mockSupabase.channel).toHaveBeenCalledWith("webrtc_signals");
    });

    it("should handle incoming call notifications", () => {
      const mockCall = {
        id: "test-call-id",
        room_id: "test-room-id",
        caller_id: "other-user-id",
        receiver_id: "receiver-user-id",
        status: "calling" as const,
        call_type: "video" as const,
        started_at: new Date().toISOString(),
      };

      const events: any[] = [];
      receiverService.addEventListener((event) => events.push(event));

      receiverService["handleIncomingCall"](mockCall);

      expect(events).toContainEqual({
        type: "incoming_call",
        call: mockCall,
      });
    });

    it("should handle incoming signals", async () => {
      const call = await callerService.startCall(
        "test-room-id",
        "receiver-user-id"
      );
      receiverService.setCurrentCall(call);

      const events: any[] = [];
      receiverService.addEventListener((event) => events.push(event));

      const signal = {
        id: "signal-id",
        call_id: call.id,
        sender_id: "caller-user-id",
        receiver_id: "receiver-user-id",
        signal_type: "offer" as const,
        signal_data: { type: "offer", sdp: "test-sdp" },
        created_at: new Date().toISOString(),
      };

      await receiverService["handleIncomingSignal"](signal);

      expect(events).toContainEqual({
        type: "signal_received",
        signal,
      });
    });
  });

  describe("Cleanup and Resource Management", () => {
    it("should clean up resources properly", async () => {
      await callerService.startCall("test-room-id", "receiver-user-id");

      const localStream = callerService.getLocalStream();
      const tracks = localStream?.getTracks() || [];

      callerService.cleanup();

      // Verify tracks were stopped
      tracks.forEach((track) => {
        expect(track.stop).toHaveBeenCalled();
      });

      // Verify streams were cleared
      expect(callerService.getLocalStream()).toBeNull();
      expect(callerService.getRemoteStream()).toBeNull();
    });

    it("should destroy service and clean up subscriptions", () => {
      callerService.destroy();

      expect(mockSupabase.removeChannel).toHaveBeenCalled();
    });
  });
});
