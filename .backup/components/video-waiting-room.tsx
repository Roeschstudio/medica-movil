"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Clock,
  Mic,
  MicOff,
  Phone,
  Settings,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface VideoWaitingRoomProps {
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
  onJoinCall: () => void;
  className?: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  isConnected: boolean;
  joinedAt?: string;
}

export function VideoWaitingRoom({
  sessionId,
  appointmentData,
  userRole,
  onJoinCall,
  className,
}: VideoWaitingRoomProps) {
  // Video ref for preview
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<
    "waiting" | "active" | "ended"
  >("waiting");
  const [timeUntilAppointment, setTimeUntilAppointment] = useState<string>("");

  // Initialize preview stream
  const initializePreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      setIsMediaReady(true);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast.error("Failed to access camera and microphone");
    }
  }, []);

  // Toggle microphone
  const toggleMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  // Fetch session status
  const fetchSessionStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/${sessionId}`);
      if (response.ok) {
        const session = await response.json();
        setSessionStatus(session.status.toLowerCase());
      }
    } catch (error) {
      console.error("Error fetching session status:", error);
    }
  }, [sessionId]);

  // Fetch participants
  const fetchParticipants = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/${sessionId}/participants`);
      if (response.ok) {
        const data = await response.json();
        setParticipants(data);
      }
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  }, [sessionId]);

  // Calculate time until appointment
  const calculateTimeUntilAppointment = useCallback(() => {
    if (!appointmentData?.scheduledAt) return;

    const now = new Date();
    const appointmentTime = new Date(appointmentData.scheduledAt);
    const diff = appointmentTime.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeUntilAppointment("Now");
      return;
    }

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      setTimeUntilAppointment(`${days}d ${hours % 24}h`);
    } else if (hours > 0) {
      setTimeUntilAppointment(`${hours}h ${minutes % 60}m`);
    } else {
      setTimeUntilAppointment(`${minutes}m`);
    }
  }, [appointmentData?.scheduledAt]);

  // Handle join call
  const handleJoinCall = useCallback(() => {
    if (!isMediaReady) {
      toast.error("Please allow camera and microphone access first");
      return;
    }

    onJoinCall();
  }, [isMediaReady, onJoinCall]);

  // Initialize component
  useEffect(() => {
    initializePreview();
    fetchSessionStatus();
    fetchParticipants();
    calculateTimeUntilAppointment();

    // Set up polling for status updates
    const statusInterval = setInterval(() => {
      fetchSessionStatus();
      fetchParticipants();
    }, 5000);

    // Set up timer for appointment countdown
    const timeInterval = setInterval(calculateTimeUntilAppointment, 60000);

    // Cleanup
    return () => {
      clearInterval(statusInterval);
      clearInterval(timeInterval);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [
    initializePreview,
    fetchSessionStatus,
    fetchParticipants,
    calculateTimeUntilAppointment,
  ]);

  const connectedParticipants = participants.filter((p) => p.isConnected);
  const waitingParticipants = participants.filter((p) => !p.isConnected);

  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-gray-50",
        className
      )}
    >
      {/* Left Panel - Video Preview */}
      <div className="flex-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Camera Preview</span>
              <Badge variant={isMediaReady ? "default" : "destructive"}>
                {isMediaReady ? "Ready" : "Setting up..."}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                  <VideoOff className="w-12 h-12 text-gray-400" />
                </div>
              )}

              {/* Controls Overlay */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-3">
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="sm"
                  onClick={toggleMicrophone}
                  className="rounded-full"
                >
                  {isMuted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>

                <Button
                  variant={!isVideoEnabled ? "destructive" : "secondary"}
                  size="sm"
                  onClick={toggleVideo}
                  className="rounded-full"
                >
                  {!isVideoEnabled ? (
                    <VideoOff className="w-4 h-4" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                </Button>

                <Button variant="secondary" size="sm" className="rounded-full">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Session Info */}
      <div className="w-full lg:w-96 space-y-6">
        {/* Appointment Info */}
        {appointmentData && (
          <Card>
            <CardHeader>
              <CardTitle>Appointment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={appointmentData.doctor.profileImage} />
                  <AvatarFallback>
                    {appointmentData.doctor.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{appointmentData.doctor.name}</p>
                  <p className="text-sm text-gray-600">
                    {appointmentData.doctor.specialty}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Scheduled for:</span>
                <span className="font-medium">
                  {new Date(appointmentData.scheduledAt).toLocaleString()}
                </span>
              </div>

              {timeUntilAppointment && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Time until:</span>
                  <Badge
                    variant="outline"
                    className="flex items-center space-x-1"
                  >
                    <Clock className="w-3 h-3" />
                    <span>{timeUntilAppointment}</span>
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Session Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Session Status</span>
              <Badge
                variant={sessionStatus === "active" ? "default" : "secondary"}
              >
                {sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Session ID:</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {sessionId.slice(-8)}
                </code>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Participants:</span>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>
                    {connectedParticipants.length}/{participants.length}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        participant.isConnected ? "bg-green-500" : "bg-gray-400"
                      )}
                    />
                    <span className="text-sm">{participant.name}</span>
                  </div>
                  <Badge
                    variant={participant.isConnected ? "default" : "secondary"}
                    size="sm"
                  >
                    {participant.isConnected ? "Connected" : "Waiting"}
                  </Badge>
                </div>
              ))}

              {participants.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No participants yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Join Call Button */}
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={handleJoinCall}
              disabled={!isMediaReady}
              className="w-full"
              size="lg"
            >
              <Phone className="w-4 h-4 mr-2" />
              {sessionStatus === "active" ? "Join Call" : "Start Call"}
            </Button>

            {!isMediaReady && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Please allow camera and microphone access
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
