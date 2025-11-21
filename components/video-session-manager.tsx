"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";
import { toast } from "sonner";

interface VideoSessionManagerProps {
  sessionId: string;
  isInitiator: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  onConnectionStateChange?: (
    state: "connecting" | "connected" | "disconnected" | "failed"
  ) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
}

interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate";
  data: any;
  fromUserId: string;
  targetUserId: string;
  timestamp: string;
}

export function VideoSessionManager({
  sessionId,
  isInitiator,
  localVideoRef,
  remoteVideoRef,
  onConnectionStateChange,
  onRemoteStream,
  onError,
}: VideoSessionManagerProps) {
  // Refs
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalQueueRef = useRef<WebRTCSignal[]>([]);
  const isProcessingSignalRef = useRef(false);

  // State
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "failed"
  >("connecting");
  const [webrtcConfig, setWebrtcConfig] = useState<RTCConfiguration | null>(
    null
  );

  // Update connection state
  const updateConnectionState = useCallback(
    (state: typeof connectionState) => {
      setConnectionState(state);
      onConnectionStateChange?.(state);
    },
    [onConnectionStateChange]
  );

  // Get WebRTC configuration
  const getWebRTCConfig = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/${sessionId}/signal`);
      if (response.ok) {
        const data = await response.json();
        setWebrtcConfig(data.webrtcConfig);
        return data.webrtcConfig;
      }
    } catch (error) {
      console.error("Error getting WebRTC config:", error);
    }

    // Fallback configuration
    const fallbackConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };
    setWebrtcConfig(fallbackConfig);
    return fallbackConfig;
  }, [sessionId]);

  // Send WebRTC signal
  const sendSignal = useCallback(
    async (type: WebRTCSignal["type"], data: any, targetUserId: string) => {
      try {
        const response = await fetch(`/api/video/${sessionId}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            data,
            targetUserId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send signal");
        }

        console.log(`Sent ${type} signal to ${targetUserId}`);
      } catch (error) {
        console.error("Error sending signal:", error);
        onError?.(error as Error);
      }
    },
    [sessionId, onError]
  );

  // Process signal queue
  const processSignalQueue = useCallback(() => {
    if (
      isProcessingSignalRef.current ||
      !peerRef.current ||
      signalQueueRef.current.length === 0
    ) {
      return;
    }

    isProcessingSignalRef.current = true;

    try {
      while (signalQueueRef.current.length > 0) {
        const signal = signalQueueRef.current.shift();
        if (signal) {
          console.log(
            `Processing ${signal.type} signal from ${signal.fromUserId}`
          );
          peerRef.current.signal(signal.data);
        }
      }
    } catch (error) {
      console.error("Error processing signal:", error);
      onError?.(error as Error);
    } finally {
      isProcessingSignalRef.current = false;
    }
  }, [onError]);

  // Initialize peer connection
  const initializePeer = useCallback(
    async (localStream: MediaStream, config: RTCConfiguration) => {
      try {
        // Create peer instance
        const peer = new SimplePeer({
          initiator: isInitiator,
          trickle: true,
          stream: localStream,
          config,
        });

        peerRef.current = peer;

        // Handle peer events
        peer.on("signal", (data) => {
          console.log("Peer signal generated:", data.type);

          // In a real implementation, you would get the target user ID from the session participants
          // For now, we'll use a placeholder
          const targetUserId = "other-participant";

          if (data.type === "offer") {
            sendSignal("offer", data, targetUserId);
          } else if (data.type === "answer") {
            sendSignal("answer", data, targetUserId);
          } else if (data.candidate) {
            sendSignal("ice-candidate", data, targetUserId);
          }
        });

        peer.on("connect", () => {
          console.log("Peer connected");
          updateConnectionState("connected");
          toast.success("Video call connected");
        });

        peer.on("stream", (remoteStream) => {
          console.log("Received remote stream");

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }

          onRemoteStream?.(remoteStream);
        });

        peer.on("close", () => {
          console.log("Peer connection closed");
          updateConnectionState("disconnected");
        });

        peer.on("error", (error) => {
          console.error("Peer error:", error);
          updateConnectionState("failed");
          onError?.(error);
          toast.error("Video call connection failed");
        });

        // Process any queued signals
        processSignalQueue();
      } catch (error) {
        console.error("Error initializing peer:", error);
        updateConnectionState("failed");
        onError?.(error as Error);
      }
    },
    [
      isInitiator,
      sendSignal,
      remoteVideoRef,
      onRemoteStream,
      updateConnectionState,
      onError,
      processSignalQueue,
    ]
  );

  // Get local media stream
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
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

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error("Error getting local stream:", error);
      updateConnectionState("failed");
      onError?.(error as Error);
      throw error;
    }
  }, [localVideoRef, updateConnectionState, onError]);

  // Handle incoming signals (in a real implementation, this would come from WebSocket/SSE)
  const handleIncomingSignal = useCallback((signal: WebRTCSignal) => {
    console.log(`Received ${signal.type} signal from ${signal.fromUserId}`);

    if (peerRef.current && peerRef.current.destroyed === false) {
      try {
        peerRef.current.signal(signal.data);
      } catch (error) {
        console.error("Error handling signal:", error);
        // Queue the signal for later processing
        signalQueueRef.current.push(signal);
      }
    } else {
      // Queue the signal until peer is ready
      signalQueueRef.current.push(signal);
    }
  }, []);

  // Initialize the video session
  const initializeSession = useCallback(async () => {
    try {
      updateConnectionState("connecting");

      // Get WebRTC configuration
      const config = await getWebRTCConfig();

      // Get local media stream
      const localStream = await getLocalStream();

      // Initialize peer connection
      await initializePeer(localStream, config);
    } catch (error) {
      console.error("Error initializing session:", error);
      updateConnectionState("failed");
      onError?.(error as Error);
    }
  }, [
    getWebRTCConfig,
    getLocalStream,
    initializePeer,
    updateConnectionState,
    onError,
  ]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    signalQueueRef.current = [];
    updateConnectionState("disconnected");
  }, [updateConnectionState]);

  // Initialize on mount
  useEffect(() => {
    initializeSession();

    return cleanup;
  }, [initializeSession, cleanup]);

  // Expose methods for parent component
  useEffect(() => {
    // In a real implementation, you would set up WebSocket/SSE listeners here
    // to receive incoming signals and call handleIncomingSignal
  }, [handleIncomingSignal]);

  return null; // This is a logic-only component
}
