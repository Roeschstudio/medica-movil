import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import {
  CallType,
  MediaStreamState,
  VideoCall,
  VideoCallEvent,
  VideoCallService,
} from "@/lib/video-call-service";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseVideoCallState {
  // Call state
  currentCall: VideoCall | null;
  isInCall: boolean;
  isConnecting: boolean;
  incomingCall: VideoCall | null;
  callStatus: string;
  connectionState: RTCPeerConnectionState | null;

  // Media state
  mediaState: MediaStreamState;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;

  // Error state
  error: Error | null;
  isWebRTCSupported: boolean;

  // Performance state
  connectionMetrics: any;
  currentVideoQuality: string;
  availableQualities: string[];
  adaptiveQualityEnabled: boolean;

  // Actions
  startCall: (
    roomId: string,
    receiverId: string,
    callType?: CallType
  ) => Promise<void>;
  answerCall: (callId: string, accept: boolean) => Promise<void>;
  endCall: (reason?: string) => Promise<void>;
  toggleCamera: () => boolean;
  toggleMicrophone: () => boolean;
  clearError: () => void;
  dismissIncomingCall: () => void;

  // Performance actions
  setVideoQuality: (quality: string) => Promise<void>;
  setAdaptiveQuality: (enabled: boolean) => void;
  setFullscreen: () => void;
}

export function useVideoCall(): UseVideoCallState {
  const { user } = useUnifiedAuth();
  const supabase = createSupabaseBrowserClient();

  // State management
  const [currentCall, setCurrentCall] = useState<VideoCall | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWebRTCSupported, setIsWebRTCSupported] = useState(true);
  const [incomingCall, setIncomingCall] = useState<VideoCall | null>(null);
  const [callStatus, setCallStatus] = useState<string>("idle");
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState | null>(null);
  const [mediaState, setMediaState] = useState<MediaStreamState>({
    localStream: null,
    remoteStream: null,
    isCameraEnabled: true,
    isMicrophoneEnabled: true,
  });
  const [error, setError] = useState<Error | null>(null);

  // Performance state
  const [connectionMetrics, setConnectionMetrics] = useState<any>({});
  const [currentVideoQuality, setCurrentVideoQuality] =
    useState<string>("medium");
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [adaptiveQualityEnabled, setAdaptiveQualityEnabled] =
    useState<boolean>(true);

  // Video element refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Video call service instance
  const videoCallServiceRef = useRef<VideoCallService | null>(null);

  // Check WebRTC compatibility on mount
  useEffect(() => {
    const supported = WebRTCCompatibility.isSupported();
    setIsWebRTCSupported(supported);

    if (!supported) {
      const compatibilityError = VideoCallErrorHandler.createError(
        VideoCallErrorType.WEBRTC_NOT_SUPPORTED
      );
      setError(compatibilityError);
    }
  }, []);

  // Initialize video call service
  useEffect(() => {
    if (user?.id && !videoCallServiceRef.current && isWebRTCSupported) {
      videoCallServiceRef.current = new VideoCallService(supabase, user.id);

      // Initialize performance state
      setAvailableQualities(
        videoCallServiceRef.current.getAvailableVideoQualities()
      );
      setCurrentVideoQuality(
        videoCallServiceRef.current.getCurrentVideoQuality()
      );

      // Setup event listeners
      const handleVideoCallEvent = (event: VideoCallEvent) => {
        switch (event.type) {
          case "call_created":
            setCurrentCall(event.call);
            setIsInCall(true);
            setIsConnecting(true);
            setCallStatus("calling");
            break;

          case "call_updated":
            setCurrentCall(event.call);
            setCallStatus(event.call.status);

            if (event.call.status === "active") {
              setIsConnecting(false);
              setIsInCall(true);
            } else if (
              event.call.status === "ended" ||
              event.call.status === "declined" ||
              event.call.status === "failed"
            ) {
              setIsInCall(false);
              setIsConnecting(false);
              setCurrentCall(null);
              setCallStatus("idle");
            }
            break;

          case "incoming_call":
            setIncomingCall(event.call);
            break;

          case "signal_received":
            // Signal handling is done internally by the service
            break;

          case "connection_state_changed":
            setConnectionState(event.state);

            if (event.state === "connected") {
              setIsConnecting(false);
              setCallStatus("active");

              // Update call status in database
              if (currentCall) {
                videoCallServiceRef.current?.updateVideoCall(currentCall.id, {
                  status: "active",
                });
              }

              // Start performance monitoring
              const metricsInterval = setInterval(() => {
                if (videoCallServiceRef.current) {
                  setConnectionMetrics(
                    videoCallServiceRef.current.getConnectionMetrics()
                  );
                  setCurrentVideoQuality(
                    videoCallServiceRef.current.getCurrentVideoQuality()
                  );
                }
              }, 2000);

              // Store interval for cleanup
              (videoCallServiceRef.current as any)._metricsInterval =
                metricsInterval;
            } else if (
              event.state === "failed" ||
              event.state === "disconnected"
            ) {
              setError(new Error("Connection failed"));
            }
            break;

          case "remote_stream_added":
            setMediaState((prev) => ({
              ...prev,
              remoteStream: event.stream,
            }));

            // Attach remote stream to video element
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.stream;
            }
            break;

          case "error":
            setError(event.error);
            setIsConnecting(false);
            break;
        }
      };

      videoCallServiceRef.current.addEventListener(handleVideoCallEvent);

      // Cleanup on unmount
      return () => {
        if (videoCallServiceRef.current) {
          videoCallServiceRef.current.removeEventListener(handleVideoCallEvent);
          videoCallServiceRef.current.destroy();
          videoCallServiceRef.current = null;
        }
      };
    }
  }, [user?.id, supabase, currentCall]);

  // Update media state when service state changes
  useEffect(() => {
    if (videoCallServiceRef.current) {
      const serviceMediaState =
        videoCallServiceRef.current.getMediaStreamState();
      setMediaState(serviceMediaState);

      // Attach local stream to video element
      if (localVideoRef.current && serviceMediaState.localStream) {
        localVideoRef.current.srcObject = serviceMediaState.localStream;
      }
    }
  }, [isInCall, isConnecting]);

  // Start a new video call
  const startCall = useCallback(
    async (
      roomId: string,
      receiverId: string,
      callType: CallType = "video"
    ) => {
      if (!isWebRTCSupported) {
        const error = VideoCallErrorHandler.createError(
          VideoCallErrorType.WEBRTC_NOT_SUPPORTED
        );
        setError(error);
        throw error;
      }

      if (!videoCallServiceRef.current) {
        const error = VideoCallErrorHandler.createError(
          VideoCallErrorType.UNKNOWN_ERROR,
          new Error("Video call service not initialized")
        );
        setError(error);
        throw error;
      }

      try {
        setError(null);
        setIsConnecting(true);
        await videoCallServiceRef.current.startCall(
          roomId,
          receiverId,
          callType
        );
      } catch (originalError) {
        const errorType = VideoCallErrorHandler.detectErrorType(
          originalError as Error
        );
        const error = VideoCallErrorHandler.createError(
          errorType,
          originalError as Error
        );
        setError(error);
        setIsConnecting(false);
        throw error;
      }
    },
    [isWebRTCSupported]
  );

  // Answer an incoming call
  const answerCall = useCallback(
    async (callId: string, accept: boolean) => {
      if (!videoCallServiceRef.current) {
        throw new Error("Video call service not initialized");
      }

      try {
        setError(null);

        if (accept) {
          setIsConnecting(true);
          setCurrentCall(incomingCall);
          setIsInCall(true);
        }

        await videoCallServiceRef.current.answerCall(callId, accept);
        setIncomingCall(null);
      } catch (error) {
        setError(
          error instanceof Error ? error : new Error("Failed to answer call")
        );
        setIsConnecting(false);
        setIsInCall(false);
        setCurrentCall(null);
        throw error;
      }
    },
    [incomingCall]
  );

  // End the current call
  const endCall = useCallback(async (reason: string = "user_ended") => {
    if (!videoCallServiceRef.current) {
      return;
    }

    try {
      setError(null);
      await videoCallServiceRef.current.endCall(reason);

      // Reset state
      setCurrentCall(null);
      setIsInCall(false);
      setIsConnecting(false);
      setCallStatus("idle");
      setConnectionState(null);
      setMediaState({
        localStream: null,
        remoteStream: null,
        isCameraEnabled: true,
        isMicrophoneEnabled: true,
      });

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      // Clear performance monitoring
      if ((videoCallServiceRef.current as any)._metricsInterval) {
        clearInterval((videoCallServiceRef.current as any)._metricsInterval);
        (videoCallServiceRef.current as any)._metricsInterval = null;
      }
      setConnectionMetrics({});
      setCurrentVideoQuality("medium");
    } catch (error) {
      setError(
        error instanceof Error ? error : new Error("Failed to end call")
      );
      throw error;
    }
  }, []);

  // Toggle camera on/off
  const toggleCamera = useCallback((): boolean => {
    if (!videoCallServiceRef.current) {
      return false;
    }

    const enabled = videoCallServiceRef.current.toggleCamera();
    setMediaState((prev) => ({
      ...prev,
      isCameraEnabled: enabled,
    }));

    return enabled;
  }, []);

  // Toggle microphone on/off
  const toggleMicrophone = useCallback((): boolean => {
    if (!videoCallServiceRef.current) {
      return false;
    }

    const enabled = videoCallServiceRef.current.toggleMicrophone();
    setMediaState((prev) => ({
      ...prev,
      isMicrophoneEnabled: enabled,
    }));

    return enabled;
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Dismiss incoming call notification
  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  // Performance action functions
  const setVideoQuality = useCallback(async (quality: string) => {
    if (!videoCallServiceRef.current) return;

    try {
      await videoCallServiceRef.current.setManualVideoQuality(quality);
      setCurrentVideoQuality(quality);
      setAdaptiveQualityEnabled(false);
    } catch (error) {
      console.error("Failed to set video quality:", error);
    }
  }, []);

  const setAdaptiveQuality = useCallback((enabled: boolean) => {
    if (!videoCallServiceRef.current) return;

    videoCallServiceRef.current.setAdaptiveQuality(enabled);
    setAdaptiveQualityEnabled(enabled);
  }, []);

  const setFullscreen = useCallback(() => {
    if (!videoCallServiceRef.current) return;

    videoCallServiceRef.current.setFullscreenUsed();
  }, []);

  // Preload dependencies based on user context
  useEffect(() => {
    if (user && shouldPreloadVideoCall(user.role, isInCall)) {
      preloadVideoCallDependencies();
    }
  }, [user, isInCall]);

  return {
    // State
    currentCall,
    isInCall,
    isConnecting,
    incomingCall,
    callStatus,
    connectionState,
    mediaState,
    localVideoRef,
    remoteVideoRef,
    error,
    isWebRTCSupported,

    // Performance state
    connectionMetrics,
    currentVideoQuality,
    availableQualities,
    adaptiveQualityEnabled,

    // Actions
    startCall,
    answerCall,
    endCall,
    toggleCamera,
    toggleMicrophone,
    clearError,
    dismissIncomingCall,

    // Performance actions
    setVideoQuality,
    setAdaptiveQuality,
    setFullscreen,
  };
}
