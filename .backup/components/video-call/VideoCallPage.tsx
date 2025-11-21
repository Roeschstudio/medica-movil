"use client";

import { Button } from "@/components/ui/button";
import { useVideoCall } from "@/hooks/useVideoCall";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { VideoCallInterface } from "./VideoCallInterface";

interface VideoCallPageProps {
  callId?: string;
  chatRoomId?: string;
}

export function VideoCallPage({ callId, chatRoomId }: VideoCallPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoCallState = useVideoCall();

  const { currentCall, isInCall, isConnecting, callStatus } = videoCallState;

  // Get parameters from URL if not provided as props
  const actualCallId = callId || searchParams.get("callId");
  const actualChatRoomId = chatRoomId || searchParams.get("chatRoomId");

  // Navigate back to chat
  const navigateToChat = () => {
    if (actualChatRoomId) {
      router.push(`/chat/${actualChatRoomId}`);
    } else {
      router.back();
    }
  };

  // Auto-navigate back to chat when call ends
  useEffect(() => {
    if (
      currentCall &&
      (callStatus === "ended" ||
        callStatus === "declined" ||
        callStatus === "failed")
    ) {
      // Small delay to show the end state before navigating
      const timeout = setTimeout(() => {
        navigateToChat();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [callStatus, currentCall]);

  // If no call is active and we're not connecting, redirect to chat
  useEffect(() => {
    if (!isInCall && !isConnecting && !currentCall) {
      navigateToChat();
    }
  }, [isInCall, isConnecting, currentCall]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 text-white z-10">
        <Button
          onClick={navigateToChat}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Chat
        </Button>

        <div className="flex items-center gap-4">
          <div className="text-sm">
            {isConnecting && "Connecting..."}
            {isInCall && callStatus === "active" && "Video Call Active"}
            {callStatus === "calling" && "Calling..."}
            {callStatus === "ringing" && "Ringing..."}
            {callStatus === "ended" && "Call Ended"}
            {callStatus === "declined" && "Call Declined"}
            {callStatus === "failed" && "Call Failed"}
          </div>

          {actualChatRoomId && (
            <Button
              onClick={navigateToChat}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
          )}
        </div>
      </div>

      {/* Video call interface */}
      <div className="flex-1">
        <VideoCallInterface
          videoCallState={videoCallState}
          className="h-full"
        />
      </div>
    </div>
  );
}
