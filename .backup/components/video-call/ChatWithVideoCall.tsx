"use client";

import OptimizedChatRoom from "@/components/optimized-chat-room";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useVideoCall } from "@/hooks/useVideoCall";
import { cn } from "@/lib/utils";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";
import { VideoCallButton } from "./VideoCallButton";
import { VideoCallInterface } from "./VideoCallInterface";

interface ChatWithVideoCallProps {
  chatRoomId: string;
  appointmentId?: string;
  receiverId: string;
  className?: string;
  onClose?: () => void;
}

export function ChatWithVideoCall({
  chatRoomId,
  appointmentId,
  receiverId,
  className,
  onClose,
}: ChatWithVideoCallProps) {
  const videoCallState = useVideoCall();
  const [isVideoCallExpanded, setIsVideoCallExpanded] = useState(false);
  const [showVideoCallPage, setShowVideoCallPage] = useState(false);

  const { isInCall, isConnecting, incomingCall, currentCall } = videoCallState;

  // Show video call in fullscreen mode
  const showVideoCallFullscreen = () => {
    setShowVideoCallPage(true);
  };

  // Return to chat interface
  const returnToChat = () => {
    setShowVideoCallPage(false);
  };

  // Enhanced chat room with video call button
  const ChatRoomWithVideoButton = () => (
    <div className="relative h-full">
      <OptimizedChatRoom
        chatRoomId={chatRoomId}
        appointmentId={appointmentId}
        className="h-full"
        onClose={onClose}
      />

      {/* Video call button overlay in chat header */}
      <div className="absolute top-4 right-16 z-10">
        <VideoCallButton
          videoCallState={videoCallState}
          roomId={chatRoomId}
          receiverId={receiverId}
        />
      </div>
    </div>
  );

  // Fullscreen video call page
  if (showVideoCallPage) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Header with back button */}
        <div className="flex items-center justify-between p-4 bg-black/80 text-white">
          <Button
            onClick={returnToChat}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>

          <div className="text-sm">
            Video Call {currentCall && `- ${currentCall.status}`}
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

  // Main chat interface with integrated video calling
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Incoming call notification */}
      {incomingCall && !isInCall && (
        <div className="mb-4">
          <VideoCallInterface videoCallState={videoCallState} />
        </div>
      )}

      {/* Video call interface when active */}
      {(isInCall || isConnecting) && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Video Call</h3>
              <div className="flex gap-2">
                <Button
                  onClick={showVideoCallFullscreen}
                  variant="outline"
                  size="sm"
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Fullscreen
                </Button>
                <Button
                  onClick={() => setIsVideoCallExpanded(!isVideoCallExpanded)}
                  variant="outline"
                  size="sm"
                >
                  {isVideoCallExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "transition-all duration-300",
                isVideoCallExpanded ? "h-96" : "h-48"
              )}
            >
              <VideoCallInterface
                videoCallState={videoCallState}
                className="h-full"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat interface */}
      <div className="flex-1 min-h-0">
        <ChatRoomWithVideoButton />
      </div>
    </div>
  );
}
