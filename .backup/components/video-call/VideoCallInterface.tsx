"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UseVideoCallState } from "@/hooks/useVideoCall";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Clock,
  Loader2,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { VideoCallErrorRecovery } from "./VideoCallErrorRecovery";

interface VideoCallInterfaceProps {
  videoCallState: UseVideoCallState;
  className?: string;
}

export function VideoCallInterface({
  videoCallState,
  className,
}: VideoCallInterfaceProps) {
  const {
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
    answerCall,
    endCall,
    toggleCamera,
    toggleMicrophone,
    clearError,
    dismissIncomingCall,
  } = videoCallState;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isInCall && callStatus === "active" && currentCall?.answered_at) {
      interval = setInterval(() => {
        const startTime = new Date(currentCall.answered_at!);
        const now = new Date();
        const duration = Math.floor(
          (now.getTime() - startTime.getTime()) / 1000
        );
        setCallDuration(duration);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInCall, callStatus, currentCall?.answered_at]);

  // Auto-hide controls
  useEffect(() => {
    if (isInCall && callStatus === "active") {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }

      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);

      setControlsTimeout(timeout);

      return () => {
        if (timeout) clearTimeout(timeout);
      };
    }
  }, [isInCall, callStatus, showControls]);

  // Handle mouse movement to show controls
  const handleMouseMove = () => {
    if (isInCall && callStatus === "active") {
      setShowControls(true);
    }
  };

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle call answer
  const handleAnswerCall = async (accept: boolean) => {
    if (!incomingCall) return;

    try {
      await answerCall(incomingCall.id, accept);
    } catch (error) {
      console.error("Failed to answer call:", error);
    }
  };

  // Handle call end
  const handleEndCall = async () => {
    try {
      await endCall("user_ended");
    } catch (error) {
      console.error("Failed to end call:", error);
    }
  };

  // Render incoming call notification
  if (incomingCall && !isInCall) {
    return (
      <Card
        className={cn(
          "p-6 bg-white shadow-lg border-2 border-blue-200",
          className
        )}
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Video className="w-8 h-8 text-blue-600" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Incoming Video Call
            </h3>
            <p className="text-gray-600">
              {incomingCall.call_type === "video" ? "Video" : "Audio"} call
              incoming
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => handleAnswerCall(false)}
              variant="outline"
              size="lg"
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <PhoneOff className="w-5 h-5 mr-2" />
              Decline
            </Button>
            <Button
              onClick={() => handleAnswerCall(true)}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              <Phone className="w-5 h-5 mr-2" />
              Accept
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Render connecting state
  if (isConnecting) {
    return (
      <Card className={cn("p-8 bg-white shadow-lg", className)}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Connecting...
            </h3>
            <p className="text-gray-600">
              {callStatus === "calling"
                ? "Calling..."
                : "Establishing connection..."}
            </p>
          </div>

          <Button
            onClick={handleEndCall}
            variant="outline"
            className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
          >
            <PhoneOff className="w-5 h-5 mr-2" />
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  // Render active call interface
  if (isInCall && callStatus === "active") {
    return (
      <div
        className={cn(
          "relative bg-black rounded-lg overflow-hidden",
          isFullscreen ? "fixed inset-0 z-50" : "aspect-video",
          className
        )}
        onMouseMove={handleMouseMove}
      >
        {/* Remote video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Local video (picture-in-picture) */}
        <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!mediaState.isCameraEnabled && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <VideoOff className="w-6 h-6 text-white" />
            </div>
          )}
        </div>

        {/* Call duration */}
        <div className="absolute top-4 left-4">
          <Badge
            variant="secondary"
            className="bg-black/50 text-white border-white/20"
          >
            <Clock className="w-3 h-3 mr-1" />
            {formatDuration(callDuration)}
          </Badge>
        </div>

        {/* Connection status */}
        {connectionState && connectionState !== "connected" && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
            <Badge variant="destructive" className="bg-yellow-600">
              <AlertCircle className="w-3 h-3 mr-1" />
              {connectionState}
            </Badge>
          </div>
        )}

        {/* Controls */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex items-center justify-center gap-4">
            {/* Camera toggle */}
            <Button
              onClick={toggleCamera}
              size="lg"
              variant={mediaState.isCameraEnabled ? "secondary" : "destructive"}
              className="rounded-full w-12 h-12 p-0"
            >
              {mediaState.isCameraEnabled ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </Button>

            {/* Microphone toggle */}
            <Button
              onClick={toggleMicrophone}
              size="lg"
              variant={
                mediaState.isMicrophoneEnabled ? "secondary" : "destructive"
              }
              className="rounded-full w-12 h-12 p-0"
            >
              {mediaState.isMicrophoneEnabled ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </Button>

            {/* End call */}
            <Button
              onClick={handleEndCall}
              size="lg"
              variant="destructive"
              className="rounded-full w-12 h-12 p-0 bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>

            {/* Fullscreen toggle */}
            <Button
              onClick={toggleFullscreen}
              size="lg"
              variant="secondary"
              className="rounded-full w-12 h-12 p-0"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <VideoCallErrorRecovery
        error={error}
        onDismiss={clearError}
        onRetry={() => {
          clearError();
          // Could add retry logic here if needed
        }}
        className={className}
      />
    );
  }

  // Render WebRTC not supported
  if (typeof window !== "undefined" && !window.RTCPeerConnection) {
    return (
      <Card className={cn("p-6 bg-yellow-50 border-yellow-200", className)}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-yellow-900">
              Video Calls Not Supported
            </h3>
            <p className="text-yellow-700">
              Your browser doesn't support video calling. Please use a modern
              browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Default idle state
  return null;
}
