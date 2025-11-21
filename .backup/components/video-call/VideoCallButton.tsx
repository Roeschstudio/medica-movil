"use client";

import { Button } from "@/components/ui/button";
import { UseVideoCallState } from "@/hooks/useVideoCall";
import { cn } from "@/lib/utils";
import { Loader2, Video, VideoOff } from "lucide-react";

interface VideoCallButtonProps {
  videoCallState: UseVideoCallState;
  roomId: string;
  receiverId: string;
  className?: string;
  disabled?: boolean;
}

export function VideoCallButton({
  videoCallState,
  roomId,
  receiverId,
  className,
  disabled = false,
}: VideoCallButtonProps) {
  const { isInCall, isConnecting, startCall, endCall, error } = videoCallState;

  const handleClick = async () => {
    if (isInCall || isConnecting) {
      // End current call
      try {
        await endCall("user_ended");
      } catch (error) {
        console.error("Failed to end call:", error);
      }
    } else {
      // Start new call
      try {
        await startCall(roomId, receiverId, "video");
      } catch (error) {
        console.error("Failed to start call:", error);
      }
    }
  };

  // Don't show button if WebRTC is not supported
  if (typeof window !== "undefined" && !window.RTCPeerConnection) {
    return null;
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isConnecting}
      variant={isInCall ? "destructive" : "outline"}
      size="sm"
      className={cn(
        "transition-colors",
        isInCall && "bg-red-600 hover:bg-red-700",
        className
      )}
    >
      {isConnecting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : isInCall ? (
        <VideoOff className="w-4 h-4 mr-2" />
      ) : (
        <Video className="w-4 h-4 mr-2" />
      )}

      {isConnecting ? "Connecting..." : isInCall ? "End Call" : "Video Call"}
    </Button>
  );
}
