import { VideoCallSecurity } from "./video-call-security";
import { ErrorLogger } from "./error-handling-utils";

// Enhanced WebRTC Configuration with optimized ICE servers
const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    // Google STUN servers with load balancing
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Additional STUN servers for redundancy
    { urls: "stun:stun.stunprotocol.org:3478" },
    { urls: "stun:stun.voiparound.com" },
    { urls: "stun:stun.voipbuster.com" },
  ],
  // Optimize ICE gathering
  iceCandidatePoolSize: 10,
  // Enable bundle policy for better performance
  bundlePolicy: "max-bundle",
  // Optimize RTP parameters
  rtcpMuxPolicy: "require",
};

// Performance monitoring interface
interface ConnectionMetrics {
  connectionTime: number;
  iceGatheringTime: number;
  signalLatency: number;
  bandwidth: number;
  packetLoss: number;
  jitter: number;
}

// Video quality levels for adaptive streaming
interface VideoQuality {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}

const VIDEO_QUALITY_LEVELS: Record<string, VideoQuality> = {
  low: { width: 320, height: 240, frameRate: 15, bitrate: 150000 },
  medium: { width: 640, height: 480, frameRate: 24, bitrate: 500000 },
  high: { width: 1280, height: 720, frameRate: 30, bitrate: 1200000 },
  ultra: { width: 1920, height: 1080, frameRate: 30, bitrate: 2500000 },
};

// Signal batching configuration
const SIGNAL_BATCH_CONFIG = {
  maxBatchSize: 10,
  batchTimeoutMs: 100,
  prioritySignals: ["offer", "answer"] as const,
};

// Call status types
export type CallStatus =
  | "calling"
  | "ringing"
  | "active"
  | "ended"
  | "declined"
  | "failed";
export type CallType = "video" | "audio";

// Video call interface
export interface VideoCall {
  id: string;
  room_id: string;
  caller_id: string;
  receiver_id: string;
  status: CallStatus;
  call_type: CallType;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  end_reason?: string;
}

// WebRTC signal interface
export interface WebRTCSignal {
  id: string;
  call_id: string;
  sender_id: string;
  receiver_id: string;
  signal_type: "offer" | "answer" | "ice_candidate";
  signal_data: any;
  created_at: string;
}

// Media stream state interface
export interface MediaStreamState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
}

// Event types for VideoCallService
export type VideoCallEvent =
  | { type: "call_created"; call: VideoCall }
  | { type: "call_updated"; call: VideoCall }
  | { type: "incoming_call"; call: VideoCall }
  | { type: "signal_received"; signal: WebRTCSignal }
  | { type: "connection_state_changed"; state: RTCPeerConnectionState }
  | { type: "remote_stream_added"; stream: MediaStream }
  | { type: "error"; error: Error };

export class VideoCallService {
  private supabase: any;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCall: VideoCall | null = null;
  private userId: string | null = null;
  private eventListeners: ((event: VideoCallEvent) => void)[] = [];
  private mediaStreamState: MediaStreamState = {
    localStream: null,
    remoteStream: null,
    isCameraEnabled: true,
    isMicrophoneEnabled: true,
  };
  private signalSubscription: any = null;
  private callSubscription: any = null;

  // Performance optimization properties
  private connectionMetrics: ConnectionMetrics = {
    connectionTime: 0,
    iceGatheringTime: 0,
    signalLatency: 0,
    bandwidth: 0,
    packetLoss: 0,
    jitter: 0,
  };
  private currentVideoQuality: string = "medium";
  private signalBatch: Array<{ type: string; data: any; timestamp: number }> =
    [];
  private batchTimer: NodeJS.Timeout | null = null;
  private connectionStartTime: number = 0;
  private iceGatheringStartTime: number = 0;
  private statsInterval: NodeJS.Timeout | null = null;
  private adaptiveQualityEnabled: boolean = true;
  private connectionPool: Map<string, RTCPeerConnection> = new Map();
  private monitoring: VideoCallMonitoring;
  private featureUsage = {
    cameraToggled: 0,
    microphoneToggled: 0,
    fullscreenUsed: false,
    qualityAdjustments: 0,
  };

  constructor(supabaseClient: any, userId: string) {
    this.supabase = supabaseClient;
    this.userId = userId;
    this.monitoring = new VideoCallMonitoring(supabaseClient);
    this.setupRealtimeSubscriptions();
  }

  // Event listener management
  addEventListener(listener: (event: VideoCallEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: VideoCallEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emit(event: VideoCallEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        ErrorLogger.log(error as Error, { context: "video_call_event_listener", event: event.type });
      }
    });
  }

  // Setup RTCPeerConnection with performance optimizations
  private setupPeerConnection(): RTCPeerConnection {
    // Try to reuse existing connection if available
    const connectionKey = this.currentCall?.id || "default";
    let existingConnection = this.connectionPool.get(connectionKey);

    if (existingConnection && existingConnection.connectionState === "closed") {
      this.connectionPool.delete(connectionKey);
      existingConnection = null;
    }

    if (this.peerConnection && this.peerConnection !== existingConnection) {
      this.peerConnection.close();
    }

    // Create new connection if needed
    if (!existingConnection) {
      this.connectionStartTime = performance.now();
      this.peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);

      if (this.currentCall) {
        this.connectionPool.set(connectionKey, this.peerConnection);
      }
    } else {
      this.peerConnection = existingConnection;
    }

    // Enhanced connection state handling
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;

        // Calculate connection time
        if (state === "connected" && this.connectionStartTime > 0) {
          this.connectionMetrics.connectionTime =
            performance.now() - this.connectionStartTime;
        }

        this.emit({
          type: "connection_state_changed",
          state,
        });

        // Handle connection failures with retry logic
        if (state === "failed" || state === "disconnected") {
          this.handleConnectionFailure();
        }
      }
    };

    // Optimized ICE candidate handling with batching
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentCall) {
        // Batch ICE candidates for better performance
        this.batchSignal("ice_candidate", {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
        });
      }
    };

    // ICE gathering state monitoring
    this.peerConnection.onicegatheringstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.iceGatheringState;

        if (state === "gathering" && this.iceGatheringStartTime === 0) {
          this.iceGatheringStartTime = performance.now();
        } else if (state === "complete" && this.iceGatheringStartTime > 0) {
          this.connectionMetrics.iceGatheringTime =
            performance.now() - this.iceGatheringStartTime;
        }
      }
    };

    // Enhanced remote stream handling
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.mediaStreamState.remoteStream = this.remoteStream;

        // Start adaptive quality monitoring
        this.startConnectionMonitoring();

        this.emit({
          type: "remote_stream_added",
          stream: this.remoteStream,
        });
      }
    };

    return this.peerConnection;
  }

  // Acquire media stream for camera and microphone
  async acquireMediaStream(
    constraints: MediaStreamConstraints = { video: true, audio: true }
  ): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      this.mediaStreamState.localStream = stream;

      // Update media state based on tracks
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      this.mediaStreamState.isCameraEnabled = videoTrack
        ? videoTrack.enabled
        : false;
      this.mediaStreamState.isMicrophoneEnabled = audioTrack
        ? audioTrack.enabled
        : false;

      return stream;
    } catch (error) {
      const mediaError = new Error(
        `Failed to acquire media stream: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit({ type: "error", error: mediaError });
      throw mediaError;
    }
  }

  // Create WebRTC offer
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized");
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      const offerError = new Error(
        `Failed to create offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit({ type: "error", error: offerError });
      throw offerError;
    }
  }

  // Create WebRTC answer
  async createAnswer(
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized");
    }

    try {
      await this.peerConnection.setRemoteDescription(offer);

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      return answer;
    } catch (error) {
      const answerError = new Error(
        `Failed to create answer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit({ type: "error", error: answerError });
      throw answerError;
    }
  }

  // Handle WebRTC answer
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized");
    }

    try {
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      const handleError = new Error(
        `Failed to handle answer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit({ type: "error", error: handleError });
      throw handleError;
    }
  }

  // Handle ICE candidate
  async handleIceCandidate(candidateData: any): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized");
    }

    try {
      const candidate = new RTCIceCandidate({
        candidate: candidateData.candidate,
        sdpMLineIndex: candidateData.sdpMLineIndex,
        sdpMid: candidateData.sdpMid,
      });

      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      // ICE candidate errors are often non-fatal, log but don't throw
      ErrorLogger.log(error as Error, { context: "video_call_ice_candidate", action: "add_ice_candidate" });
    }
  }

  // Send WebRTC signal through Supabase
  private async sendSignal(
    signalType: "offer" | "answer" | "ice_candidate",
    signalData: any
  ): Promise<void> {
    if (!this.currentCall || !this.userId) {
      throw new Error("No active call or user ID");
    }

    try {
      // Security validations
      if (!VideoCallSecurity.checkRateLimit(this.userId, "signal")) {
        throw new Error("Rate limit exceeded for signaling");
      }

      // Validate signal data
      if (!VideoCallSecurity.validateSignalData(signalType, signalData)) {
        throw new Error("Invalid signal data");
      }

      // Validate session
      if (
        !VideoCallSecurity.validateSession(this.currentCall.id, this.userId)
      ) {
        throw new Error("Invalid or expired session");
      }

      // Update session activity
      VideoCallSecurity.updateSessionActivity(this.currentCall.id);

      // Sanitize signal data
      const sanitizedData = VideoCallSecurity.sanitizeCallMetadata(signalData);

      const { error } = await this.supabase.from("webrtc_signals").insert({
        call_id: this.currentCall.id,
        sender_id: this.userId,
        receiver_id:
          this.currentCall.caller_id === this.userId
            ? this.currentCall.receiver_id
            : this.currentCall.caller_id,
        signal_type: signalType,
        signal_data: sanitizedData,
      });

      if (error) {
        throw new Error(`Failed to send signal: ${error.message}`);
      }
    } catch (error) {
      const signalError = new Error(
        `Signal sending failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit({ type: "error", error: signalError });
      throw signalError;
    }
  }

  // Add local stream to peer connection
  addLocalStreamToPeerConnection(): void {
    if (!this.peerConnection || !this.localStream) {
      throw new Error("Peer connection or local stream not available");
    }

    this.localStream.getTracks().forEach((track) => {
      if (this.peerConnection && this.localStream) {
        this.peerConnection.addTrack(track, this.localStream);
      }
    });
  }

  // Get current media stream state
  getMediaStreamState(): MediaStreamState {
    return { ...this.mediaStreamState };
  }

  // Toggle camera on/off
  toggleCamera(): boolean {
    if (!this.localStream) {
      return false;
    }

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.mediaStreamState.isCameraEnabled = videoTrack.enabled;

      // Track feature usage
      this.featureUsage.cameraToggled++;

      return videoTrack.enabled;
    }

    return false;
  }

  // Toggle microphone on/off
  toggleMicrophone(): boolean {
    if (!this.localStream) {
      return false;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.mediaStreamState.isMicrophoneEnabled = audioTrack.enabled;

      // Track feature usage
      this.featureUsage.microphoneToggled++;

      return audioTrack.enabled;
    }

    return false;
  }

  // Enhanced connection failure handling with retry logic
  private async handleConnectionFailure(): Promise<void> {
    ErrorLogger.log(new Error("WebRTC connection failed, attempting recovery"), { context: "video_call_connection_failure", level: "warn" });

    // Emit error event for UI handling
    this.emit({
      type: "error",
      error: new Error("Connection failed - attempting to reconnect"),
    });

    // Implement exponential backoff retry logic
    await this.retryConnection();
  }

  // === PERFORMANCE OPTIMIZATION METHODS ===

  // Retry connection with exponential backoff
  private async retryConnection(
    attempt: number = 1,
    maxAttempts: number = 3
  ): Promise<void> {
    if (attempt > maxAttempts) {
      ErrorLogger.log(new Error("Max retry attempts reached, giving up"), { context: "video_call_retry_exhausted" });
      this.cleanup();
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Cap at 10 seconds
    ErrorLogger.log(new Error(`Retrying connection in ${delay}ms (attempt ${attempt}/${maxAttempts})`), { context: "video_call_retry", level: "info", attempt, maxAttempts, delay });

    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });

    try {
      // Clean up current connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Setup new connection
      this.setupPeerConnection();

      // Re-add local stream if available
      if (this.localStream) {
        this.addLocalStreamToPeerConnection();
      }

      // If we're the caller, create new offer
      if (this.currentCall?.caller_id === this.userId) {
        const offer = await this.createOffer();
        await this.sendSignal("offer", offer);
      }
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_retry_failed", attempt });
      await this.retryConnection(attempt + 1, maxAttempts);
    }
  }

  // Batch signals for better performance
  private batchSignal(signalType: string, signalData: any): void {
    const signal = {
      type: signalType,
      data: signalData,
      timestamp: Date.now(),
    };

    // Priority signals are sent immediately
    if (SIGNAL_BATCH_CONFIG.prioritySignals.includes(signalType as any)) {
      this.sendSignal(signalType as any, signalData);
      return;
    }

    // Add to batch
    this.signalBatch.push(signal);

    // Send batch if it's full
    if (this.signalBatch.length >= SIGNAL_BATCH_CONFIG.maxBatchSize) {
      this.flushSignalBatch();
      return;
    }

    // Set timer to flush batch
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushSignalBatch();
      }, SIGNAL_BATCH_CONFIG.batchTimeoutMs);
    }
  }

  // Flush batched signals
  private async flushSignalBatch(): Promise<void> {
    if (this.signalBatch.length === 0) return;

    const batch = [...this.signalBatch];
    this.signalBatch = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Send all batched signals
    for (const signal of batch) {
      try {
        await this.sendSignal(signal.type as any, signal.data);
      } catch (error) {
        ErrorLogger.log(error as Error, { context: "video_call_batch_signal", action: "send_batched_signal" });
      }
    }
  }

  // Start connection quality monitoring
  private startConnectionMonitoring(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(async () => {
      await this.updateConnectionMetrics();

      if (this.adaptiveQualityEnabled) {
        await this.adjustVideoQuality();
      }
    }, 5000); // Check every 5 seconds
  }

  // Update connection metrics
  private async updateConnectionMetrics(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const stats = await this.peerConnection.getStats();

      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          // Calculate bandwidth
          if (report.bytesReceived && report.timestamp) {
            const bandwidth =
              (report.bytesReceived * 8) / (report.timestamp / 1000);
            this.connectionMetrics.bandwidth = bandwidth;
          }

          // Update packet loss
          if (
            report.packetsLost !== undefined &&
            report.packetsReceived !== undefined
          ) {
            const totalPackets = report.packetsLost + report.packetsReceived;
            this.connectionMetrics.packetLoss =
              totalPackets > 0 ? report.packetsLost / totalPackets : 0;
          }

          // Update jitter
          if (report.jitter !== undefined) {
            this.connectionMetrics.jitter = report.jitter;
          }
        }
      });
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_connection_stats", action: "get_stats" });
    }
  }

  // Adjust video quality based on network conditions
  private async adjustVideoQuality(): Promise<void> {
    if (!this.localStream || !this.peerConnection) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    let targetQuality = this.currentVideoQuality;

    // Determine target quality based on metrics
    if (
      this.connectionMetrics.packetLoss > 0.05 ||
      this.connectionMetrics.bandwidth < 300000
    ) {
      targetQuality = "low";
    } else if (
      this.connectionMetrics.packetLoss > 0.02 ||
      this.connectionMetrics.bandwidth < 800000
    ) {
      targetQuality = "medium";
    } else if (this.connectionMetrics.bandwidth > 1500000) {
      targetQuality = "high";
    } else if (this.connectionMetrics.bandwidth > 3000000) {
      targetQuality = "ultra";
    }

    // Apply quality change if needed
    if (targetQuality !== this.currentVideoQuality) {
      await this.setVideoQuality(targetQuality);
    }
  }

  // Set video quality
  private async setVideoQuality(quality: string): Promise<void> {
    if (!this.localStream || !VIDEO_QUALITY_LEVELS[quality]) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const qualitySettings = VIDEO_QUALITY_LEVELS[quality];

      await videoTrack.applyConstraints({
        width: { ideal: qualitySettings.width },
        height: { ideal: qualitySettings.height },
        frameRate: { ideal: qualitySettings.frameRate },
      });

      // Update sender parameters for bitrate
      const sender = this.peerConnection
        ?.getSenders()
        .find((s) => s.track === videoTrack);
      if (sender) {
        const params = sender.getParameters();
        if (params.encodings && params.encodings[0]) {
          params.encodings[0].maxBitrate = qualitySettings.bitrate;
          await sender.setParameters(params);
        }
      }

      this.currentVideoQuality = quality;
      this.featureUsage.qualityAdjustments++;

      ErrorLogger.log(new Error(`Video quality adjusted to: ${quality}`), { context: "video_call_quality_adjustment", level: "info", quality });
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_quality_adjustment", action: "adjust_quality", quality });
    }
  }

  // Get current connection metrics
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  // Enable/disable adaptive quality
  setAdaptiveQuality(enabled: boolean): void {
    this.adaptiveQualityEnabled = enabled;

    if (!enabled && this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    } else if (enabled && this.remoteStream) {
      this.startConnectionMonitoring();
    }
  }

  // Manually set video quality
  async setManualVideoQuality(quality: string): Promise<void> {
    this.adaptiveQualityEnabled = false;
    await this.setVideoQuality(quality);
  }

  // Get available video quality levels
  getAvailableVideoQualities(): string[] {
    return Object.keys(VIDEO_QUALITY_LEVELS);
  }

  // Get current video quality
  getCurrentVideoQuality(): string {
    return this.currentVideoQuality;
  }

  // === MONITORING AND ANALYTICS METHODS ===

  // Track final call quality metrics
  private async trackFinalCallMetrics(
    callId: string,
    userId: string
  ): Promise<void> {
    try {
      const metrics: CallQualityMetrics = {
        callId,
        userId,
        connectionTime: this.connectionMetrics.connectionTime,
        iceGatheringTime: this.connectionMetrics.iceGatheringTime,
        audioQuality: {
          bitrate: 0, // Will be populated from WebRTC stats
          packetLoss: this.connectionMetrics.packetLoss,
          jitter: this.connectionMetrics.jitter,
          roundTripTime: 0, // Will be populated from WebRTC stats
        },
        videoQuality: {
          bitrate: 0, // Will be populated from WebRTC stats
          packetLoss: this.connectionMetrics.packetLoss,
          jitter: this.connectionMetrics.jitter,
          frameRate: 0, // Will be populated from WebRTC stats
          resolution: this.getCurrentVideoResolution(),
        },
        networkConditions: {
          bandwidth: this.connectionMetrics.bandwidth,
          latency: this.connectionMetrics.signalLatency,
          connectionType: this.getConnectionType(),
        },
        timestamp: new Date().toISOString(),
      };

      // Get detailed stats from WebRTC
      if (this.peerConnection) {
        const detailedMetrics = await this.getDetailedWebRTCStats();
        metrics.audioQuality = {
          ...metrics.audioQuality,
          ...detailedMetrics.audio,
        };
        metrics.videoQuality = {
          ...metrics.videoQuality,
          ...detailedMetrics.video,
        };
      }

      await this.monitoring.trackCallQuality(metrics);
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_quality_metrics", action: "track_metrics" });
    }
  }

  // Track call usage analytics
  private async trackCallUsageAnalytics(
    callId: string,
    userId: string,
    duration: number,
    endReason: string
  ): Promise<void> {
    try {
      // Determine user role from current call
      const userRole =
        this.currentCall?.caller_id === userId
          ? await this.getUserRole(userId)
          : await this.getUserRole(userId);

      const analytics: CallUsageAnalytics = {
        callId,
        userId,
        userRole: userRole || "patient", // Default to patient if unknown
        callDuration: duration,
        callType: this.currentCall?.call_type || "video",
        endReason,
        deviceInfo: VideoCallMonitoring.createDeviceInfo(),
        features: { ...this.featureUsage },
        timestamp: new Date().toISOString(),
      };

      await this.monitoring.trackUsageAnalytics(analytics);
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_usage_analytics", action: "track_analytics" });
    }
  }

  // Get detailed WebRTC statistics
  private async getDetailedWebRTCStats(): Promise<{
    audio: Partial<CallQualityMetrics["audioQuality"]>;
    video: Partial<CallQualityMetrics["videoQuality"]>;
  }> {
    if (!this.peerConnection) {
      return { audio: {}, video: {} };
    }

    try {
      const stats = await this.peerConnection.getStats();
      const audioStats: Partial<CallQualityMetrics["audioQuality"]> = {};
      const videoStats: Partial<CallQualityMetrics["videoQuality"]> = {};

      stats.forEach((report) => {
        if (report.type === "inbound-rtp") {
          if (report.mediaType === "audio") {
            audioStats.bitrate = report.bytesReceived
              ? (report.bytesReceived * 8) / (report.timestamp / 1000)
              : 0;
            audioStats.jitter = report.jitter || 0;
          } else if (report.mediaType === "video") {
            videoStats.bitrate = report.bytesReceived
              ? (report.bytesReceived * 8) / (report.timestamp / 1000)
              : 0;
            videoStats.jitter = report.jitter || 0;
            videoStats.frameRate = report.framesPerSecond || 0;
          }
        } else if (
          report.type === "candidate-pair" &&
          report.state === "succeeded"
        ) {
          const rtt = report.currentRoundTripTime || 0;
          audioStats.roundTripTime = rtt;
        }
      });

      return { audio: audioStats, video: videoStats };
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_webrtc_stats", action: "get_detailed_stats" });
      return { audio: {}, video: {} };
    }
  }

  // Get current video resolution
  private getCurrentVideoResolution(): string {
    if (!this.localStream) return "unknown";

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return "unknown";

    const settings = videoTrack.getSettings();
    return `${settings.width || 0}x${settings.height || 0}`;
  }

  // Get connection type
  private getConnectionType(): string {
    // @ts-ignore - navigator.connection is experimental
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    return connection?.effectiveType || "unknown";
  }

  // Get user role from database
  private async getUserRole(
    userId: string
  ): Promise<"doctor" | "patient" | null> {
    try {
      const { data, error } = await this.supabase
        .from("user_profiles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        ErrorLogger.log(error as Error, { context: "video_call_user_role", action: "get_role", userId: this.userId });
        return null;
      }

      return data?.role === "doctor" ? "doctor" : "patient";
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_user_role", action: "get_role_error", userId: this.userId });
      return null;
    }
  }

  // Track error events
  async trackError(
    errorType: "connection" | "media" | "signaling" | "permission" | "browser",
    errorMessage: string,
    errorStack?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    if (!this.userId) return;

    try {
      await this.monitoring.trackError({
        callId: this.currentCall?.id,
        userId: this.userId,
        errorType,
        errorMessage,
        errorStack,
        context: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          additionalData,
        },
      });
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_error_tracking", action: "track_error" });
    }
  }

  // Set fullscreen usage tracking
  setFullscreenUsed(): void {
    this.featureUsage.fullscreenUsed = true;
  }

  // Get monitoring service instance
  getMonitoring(): VideoCallMonitoring {
    return this.monitoring;
  }

  // Clean up WebRTC connections and media streams with performance optimizations
  cleanup(): void {
    // Stop local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }

    // Close peer connection (but keep in pool for potential reuse)
    if (this.peerConnection) {
      // Only close if not in connection pool or if connection failed
      const connectionKey = this.currentCall?.id || "default";
      const pooledConnection = this.connectionPool.get(connectionKey);

      if (
        this.peerConnection !== pooledConnection ||
        this.peerConnection.connectionState === "failed" ||
        this.peerConnection.connectionState === "closed"
      ) {
        this.peerConnection.close();
        this.connectionPool.delete(connectionKey);
      }

      this.peerConnection = null;
    }

    // Clear performance monitoring
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Flush any pending batched signals
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.signalBatch.length > 0) {
      this.flushSignalBatch();
    }

    // Reset performance metrics
    this.connectionMetrics = {
      connectionTime: 0,
      iceGatheringTime: 0,
      signalLatency: 0,
      bandwidth: 0,
      packetLoss: 0,
      jitter: 0,
    };

    // Reset timing variables
    this.connectionStartTime = 0;
    this.iceGatheringStartTime = 0;

    // Reset media stream state
    this.mediaStreamState = {
      localStream: null,
      remoteStream: null,
      isCameraEnabled: true,
      isMicrophoneEnabled: true,
    };

    // Clear remote stream
    this.remoteStream = null;
  }

  // Get current call
  getCurrentCall(): VideoCall | null {
    return this.currentCall;
  }

  // Set current call (used by call lifecycle methods)
  setCurrentCall(call: VideoCall | null): void {
    this.currentCall = call;
  }

  // Check WebRTC support
  static isWebRTCSupported(): boolean {
    return !!(
      window.RTCPeerConnection &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
  }

  // Get connection state
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // === SUPABASE SIGNALING INTEGRATION METHODS ===

  // Create video call record in database
  async createVideoCall(
    roomId: string,
    receiverId: string,
    callType: CallType = "video"
  ): Promise<VideoCall> {
    if (!this.userId) {
      throw new Error("User ID not available");
    }

    try {
      const { data, error } = await this.supabase
        .from("video_calls")
        .insert({
          room_id: roomId,
          caller_id: this.userId,
          receiver_id: receiverId,
          status: "calling",
          call_type: callType,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create video call: ${error.message}`);
      }

      this.currentCall = data;
      this.emit({ type: "call_created", call: data });
      return data;
    } catch (error) {
      const createError = new Error(
        `Video call creation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit({ type: "error", error: createError });
      throw createError;
    }
  }

  // Update video call status and metadata
  async updateVideoCall(
    callId: string,
    updates: Partial<VideoCall>
  ): Promise<VideoCall> {
    try {
      const { data, error } = await this.supabase
        .from("video_calls")
        .update(updates)
        .eq("id", callId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update video call: ${error.message}`);
      }

      if (this.currentCall && this.currentCall.id === callId) {
        this.currentCall = data;
      }

      this.emit({ type: "call_updated", call: data });
      return data;
    } catch (error) {
      const updateError = new Error(
        `Video call update failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit({ type: "error", error: updateError });
      throw updateError;
    }
  }

  // Retrieve WebRTC signals for a call
  async getSignalsForCall(callId: string): Promise<WebRTCSignal[]> {
    try {
      const { data, error } = await this.supabase
        .from("webrtc_signals")
        .select("*")
        .eq("call_id", callId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(`Failed to retrieve signals: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      const retrieveError = new Error(
        `Signal retrieval failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit({ type: "error", error: retrieveError });
      throw retrieveError;
    }
  }

  // Setup real-time subscriptions for incoming calls and signals
  private setupRealtimeSubscriptions(): void {
    if (!this.userId) {
      ErrorLogger.log(new Error("Cannot setup subscriptions without user ID"), { context: "video_call_subscriptions", level: "warn" });
      return;
    }

    // Subscribe to incoming video calls
    this.callSubscription = this.supabase
      .channel("video_calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_calls",
          filter: `receiver_id=eq.${this.userId}`,
        },
        (payload: any) => {
          this.handleIncomingCall(payload.new);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "video_calls",
          filter: `caller_id=eq.${this.userId},receiver_id=eq.${this.userId}`,
        },
        (payload: any) => {
          this.handleCallStatusUpdate(payload.new);
        }
      )
      .subscribe();

    // Subscribe to WebRTC signals
    this.signalSubscription = this.supabase
      .channel("webrtc_signals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "webrtc_signals",
          filter: `receiver_id=eq.${this.userId}`,
        },
        (payload: any) => {
          this.handleIncomingSignal(payload.new);
        }
      )
      .subscribe();
  }

  // Handle incoming call notifications
  private handleIncomingCall(call: VideoCall): void {
    // Only handle calls where we are the receiver
    if (call.receiver_id === this.userId && call.status === "calling") {
      this.emit({ type: "incoming_call", call });
    }
  }

  // Handle call status updates
  private handleCallStatusUpdate(call: VideoCall): void {
    // Update current call if it matches
    if (this.currentCall && this.currentCall.id === call.id) {
      this.currentCall = call;
    }

    this.emit({ type: "call_updated", call });
  }

  // Handle incoming WebRTC signals
  private async handleIncomingSignal(signal: WebRTCSignal): Promise<void> {
    // Only process signals for our current call
    if (!this.currentCall || signal.call_id !== this.currentCall.id) {
      return;
    }

    this.emit({ type: "signal_received", signal });

    try {
      switch (signal.signal_type) {
        case "offer":
          await this.handleRemoteOffer(signal.signal_data);
          break;
        case "answer":
          await this.handleAnswer(signal.signal_data);
          break;
        case "ice_candidate":
          await this.handleIceCandidate(signal.signal_data);
          break;
        default:
          ErrorLogger.log(new Error(`Unknown signal type: ${signal.signal_type}`), { context: "video_call_signal_handling", level: "warn", signalType: signal.signal_type });
      }
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_signal_handling", action: "handle_incoming_signal" });
      this.emit({
        type: "error",
        error: new Error(
          `Failed to process signal: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        ),
      });
    }
  }

  // Handle remote offer (for call receiver)
  private async handleRemoteOffer(
    offerData: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.peerConnection) {
      this.setupPeerConnection();
    }

    // Add local stream before creating answer
    if (this.localStream) {
      this.addLocalStreamToPeerConnection();
    }

    // Create and send answer
    const answer = await this.createAnswer(offerData);
    await this.sendSignal("answer", answer);
  }

  // === CALL LIFECYCLE MANAGEMENT METHODS ===

  // Start a new video call
  async startCall(
    roomId: string,
    receiverId: string,
    callType: CallType = "video"
  ): Promise<VideoCall> {
    try {
      // Security validations
      if (!this.userId) {
        throw new Error("User not authenticated");
      }

      // Check rate limiting
      if (!VideoCallSecurity.checkRateLimit(this.userId, "start_call")) {
        throw new Error("Rate limit exceeded for call initiation");
      }

      // Verify permissions
      const security = new VideoCallSecurity();
      const permissions = await security.verifyCallPermissions(
        this.userId,
        roomId,
        receiverId
      );

      if (!permissions.canInitiateCalls) {
        throw new Error("Insufficient permissions to initiate video call");
      }

      // Validate secure context
      const secureContext = VideoCallSecurity.validateSecureContext();
      if (!secureContext.isSecure) {
        throw new Error(secureContext.message || "Secure context required");
      }

      // Create call record
      const call = await this.createVideoCall(roomId, receiverId, callType);

      // Create session
      VideoCallSecurity.createSession(call.id, this.userId);

      // Log audit event
      await security.logCallEvent("call_started", call.id, this.userId, {
        call_type: callType,
        room_id: roomId,
      });

      // Setup peer connection
      this.setupPeerConnection();

      // Acquire media stream
      await this.acquireMediaStream({
        video: callType === "video",
        audio: true,
      });

      // Add local stream to peer connection
      this.addLocalStreamToPeerConnection();

      // Create and send offer
      const offer = await this.createOffer();
      await this.sendSignal("offer", offer);

      return call;
    } catch (error) {
      // Clean up on failure
      this.cleanup();
      throw error;
    }
  }

  // Answer an incoming call
  async answerCall(callId: string, accept: boolean): Promise<void> {
    try {
      if (!accept) {
        // Decline the call
        await this.updateVideoCall(callId, {
          status: "declined",
          ended_at: new Date().toISOString(),
        });
        return;
      }

      // Accept the call
      await this.updateVideoCall(callId, {
        status: "ringing",
        answered_at: new Date().toISOString(),
      });

      // Setup peer connection
      this.setupPeerConnection();

      // Acquire media stream
      await this.acquireMediaStream({
        video: true,
        audio: true,
      });

      // The offer will be handled by the real-time subscription
      // when it arrives from the caller
    } catch (error) {
      // Update call status to failed
      if (callId) {
        await this.updateVideoCall(callId, {
          status: "failed",
          ended_at: new Date().toISOString(),
          end_reason: "answer_failed",
        });
      }
      this.cleanup();
      throw error;
    }
  }

  // End the current call
  async endCall(reason: string = "user_ended"): Promise<void> {
    if (!this.currentCall) {
      return;
    }

    const callId = this.currentCall.id;

    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(
        this.currentCall.answered_at || this.currentCall.started_at
      );
      const durationSeconds = Math.floor(
        (new Date(endTime).getTime() - startTime.getTime()) / 1000
      );

      // Update call record
      await this.updateVideoCall(this.currentCall.id, {
        status: "ended",
        ended_at: endTime,
        duration_seconds: durationSeconds,
        end_reason: reason,
      });

      // Track final call quality metrics
      if (this.userId) {
        await this.trackFinalCallMetrics(callId, this.userId);
      }

      // Track usage analytics
      if (this.userId) {
        await this.trackCallUsageAnalytics(
          callId,
          this.userId,
          durationSeconds,
          reason
        );
      }

      // Log audit event
      if (this.userId) {
        const security = new VideoCallSecurity();
        await security.logCallEvent("call_ended", callId, this.userId, {
          duration_seconds: durationSeconds,
          end_reason: reason,
        });
      }

      // Clean up security session
      VideoCallSecurity.endSession(callId);

      // Clean up connections and streams
      this.cleanup();

      // Clear current call
      this.currentCall = null;
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "video_call_end", action: "end_call", callId: this.currentCall?.id });
      // Still clean up even if database update fails
      VideoCallSecurity.endSession(callId);
      this.cleanup();
      this.currentCall = null;
      throw error;
    }
  }

  // Clean up subscriptions when service is destroyed
  destroy(): void {
    if (this.callSubscription) {
      this.supabase.removeChannel(this.callSubscription);
      this.callSubscription = null;
    }

    if (this.signalSubscription) {
      this.supabase.removeChannel(this.signalSubscription);
      this.signalSubscription = null;
    }

    // Clean up connection pool
    this.connectionPool.forEach((connection) => {
      if (connection.connectionState !== "closed") {
        connection.close();
      }
    });
    this.connectionPool.clear();

    this.cleanup();
    this.eventListeners = [];

    // Clean up monitoring service
    this.monitoring.destroy();
  }
}
