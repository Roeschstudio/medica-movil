"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { VideoCallInterface } from "./video-call/VideoCallInterface";
import { VideoSessionManager } from "./video-session-manager";
import { VideoWaitingRoom } from "./video-waiting-room";

interface VideoCallPageProps {
  sessionId: string;
  appointmentData?: {
    id: string;
    scheduledAt: string;
    doctor: {
      name: string;
      specialty: string;
      profileImage?: string;
    };
    patient: {
      name: string;
    };
  };
  userRole: "doctor" | "patient";
  isInitiator?: boolean;
  onCallEnd?: () => void;
  className?: string;
}

type CallState = "waiting" | "connecting" | "active" | "ended" | "error";
type ConnectionState = "connecting" | "connected" | "disconnected" | "failed";

export function VideoCallPage({
  sessionId,
  appointmentData,
  userRole,
  isInitiator = false,
  onCallEnd,
  className,
}: VideoCallPageProps) {
  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // State
  const [callState, setCallState] = useState<CallState>("waiting");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);

  // Fetch session data
  const fetchSessionData = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setSessionData(data);

        // Update call state based on session status
        if (data.status === "ACTIVE") {
          setCallState("active");
        } else if (data.status === "ENDED" || data.status === "CANCELLED") {
          setCallState("ended");
        }
      } else {
        throw new Error("Failed to fetch session data");
      }
    } catch (error) {
      console.error("Error fetching session data:", error);
      setError("Failed to load session data");
      setCallState("error");
    }
  }, [sessionId]);

  // Handle joining the call
  const handleJoinCall = useCallback(() => {
    setCallState("connecting");
    toast.success("Joining video call...");
  }, []);

  // Handle call end
  const handleCallEnd = useCallback(async () => {
    try {
      // Update session status to ended
      await fetch(`/api/video/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ENDED" }),
      });

      setCallState("ended");
      toast.success("Call ended");

      if (onCallEnd) {
        onCallEnd();
      }
    } catch (error) {
      console.error("Error ending call:", error);
      toast.error("Failed to end call properly");
    }
  }, [sessionId, onCallEnd]);

  // Handle connection state changes
  const handleConnectionStateChange = useCallback(
    (state: ConnectionState) => {
      setConnectionState(state);

      if (state === "connected" && callState === "connecting") {
        setCallState("active");
      } else if (state === "failed") {
        setCallState("error");
        setError("Connection failed");
      }
    },
    [callState]
  );

  // Handle WebRTC errors
  const handleWebRTCError = useCallback((error: Error) => {
    console.error("WebRTC error:", error);
    setError(error.message);
    setCallState("error");
    toast.error("Video call error: " + error.message);
  }, []);

  // Handle remote stream
  const handleRemoteStream = useCallback((stream: MediaStream) => {
    console.log("Remote stream received");
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  }, []);

  // Retry connection
  const retryConnection = useCallback(() => {
    setError(null);
    setCallState("waiting");
    setConnectionState("connecting");
    fetchSessionData();
  }, [fetchSessionData]);

  // Initialize
  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  // Render error state
  if (callState === "error") {
    return (
      <div
        className={cn(
          "flex items-center justify-center min-h-screen bg-gray-50",
          className
        )}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold">Connection Error</h2>
            <p className="text-gray-600">
              {error || "An error occurred while connecting to the video call."}
            </p>
            <div className="space-y-2">
              <Button onClick={retryConnection} className="w-full">
                Try Again
              </Button>
              <Button variant="outline" onClick={onCallEnd} className="w-full">
                Leave Call
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render ended state
  if (callState === "ended") {
    return (
      <div
        className={cn(
          "flex items-center justify-center min-h-screen bg-gray-50",
          className
        )}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-green-600 text-xl">✓</span>
            </div>
            <h2 className="text-xl font-semibold">Call Ended</h2>
            <p className="text-gray-600">
              The video call has ended. Thank you for using our service.
            </p>
            {sessionData?.recordingUrl && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  A recording of this session is available for review.
                </p>
              </div>
            )}
            <Button onClick={onCallEnd} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Connection Status Indicator */}
      <div className="absolute top-4 left-4 z-50">
        <Badge
          variant={connectionState === "connected" ? "default" : "destructive"}
          className="flex items-center space-x-1"
        >
          {connectionState === "connected" ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span className="capitalize">{connectionState}</span>
        </Badge>
      </div>

      {/* Video Session Manager (handles WebRTC logic) */}
      {(callState === "connecting" || callState === "active") && (
        <VideoSessionManager
          sessionId={sessionId}
          isInitiator={isInitiator}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          onConnectionStateChange={handleConnectionStateChange}
          onRemoteStream={handleRemoteStream}
          onError={handleWebRTCError}
        />
      )}

      {/* Render appropriate component based on call state */}
      {callState === "waiting" && (
        <VideoWaitingRoom
          sessionId={sessionId}
          appointmentData={appointmentData}
          userRole={userRole}
          onJoinCall={handleJoinCall}
          className="min-h-screen"
        />
      )}

      {(callState === "connecting" || callState === "active") && (
        <div className="relative h-screen">
          {/* Hidden video elements for WebRTC */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="hidden"
          />
          <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />

          {/* Video Call Interface */}
          <VideoCallInterface
            sessionId={sessionId}
            isInitiator={isInitiator}
            onCallEnd={handleCallEnd}
            className="h-full"
          />

          {/* Connecting Overlay */}
          {callState === "connecting" && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
                  <p className="text-white">Connecting to video call...</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
