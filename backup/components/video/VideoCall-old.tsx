'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/lib/socket-context';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  Settings,
  Maximize,
  Minimize,
  Users
} from 'lucide-react';
import Peer from 'simple-peer';

interface VideoCallProps {
  sessionId: string;
  roomId: string;
  onEndCall?: () => void;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  image?: string;
  stream?: MediaStream;
  peer?: Peer.Instance;
}

export const VideoCall: React.FC<VideoCallProps> = ({ 
  sessionId, 
  roomId, 
  onEndCall 
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [sessionData, setSessionData] = useState<any>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({});
  const callStartTimeRef = useRef<Date | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: session } = useSession();
  const {
    socket,
    startVideoCall,
    endVideoCall,
    sendVideoSignal,
    onVideoCallStarted,
    onVideoCallEnded,
    onVideoSignal
  } = useSocket();

  // Load session data
  useEffect(() => {
    const loadSessionData = async () => {
      try {
        const response = await fetch(`/api/video/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setSessionData(data);
        }
      } catch (error) {
        console.error('Error loading session data:', error);
      }
    };

    loadSessionData();
  }, [sessionId]);

  // Initialize media stream
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        toast.error('Failed to access camera/microphone');
      }
    };

    initializeMedia();

    return () => {
      // Cleanup media stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleVideoCallStarted = (data: { sessionId: string; initiator: string }) => {
      if (data.sessionId === sessionId) {
        setIsCallActive(true);
        callStartTimeRef.current = new Date();
        startDurationTimer();
        
        if (data.initiator !== session?.user?.id) {
          toast.info('Video call started');
        }
      }
    };

    const handleVideoCallEnded = (data: { sessionId: string; endedBy: string }) => {
      if (data.sessionId === sessionId) {
        setIsCallActive(false);
        stopDurationTimer();
        
        if (data.endedBy !== session?.user?.id) {
          toast.info('Video call ended');
        }
        
        // Cleanup peers
        Object.values(peersRef.current).forEach(peer => {
          peer.destroy();
        });
        peersRef.current = {};
        
        onEndCall?.();
      }
    };

    const handleVideoSignal = (data: { signal: any; from: string; roomId: string }) => {
      if (data.roomId === roomId && data.from !== session?.user?.id) {
        handlePeerSignal(data.signal, data.from);
      }
    };

    onVideoCallStarted(handleVideoCallStarted);
    onVideoCallEnded(handleVideoCallEnded);
    onVideoSignal(handleVideoSignal);

    return () => {
      socket.off('video_call_started', handleVideoCallStarted);
      socket.off('video_call_ended', handleVideoCallEnded);
      socket.off('video_signal', handleVideoSignal);
    };
  }, [socket, sessionId, roomId, session?.user?.id, onVideoCallStarted, onVideoCallEnded, onVideoSignal, onEndCall]);

  // Duration timer
  const startDurationTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const now = new Date();
        const duration = Math.floor((now.getTime() - callStartTimeRef.current.getTime()) / 1000);
        setCallDuration(duration);
      }
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  // Handle peer signaling
  const handlePeerSignal = (signal: any, peerId: string) => {
    if (!localStream) return;

    let peer = peersRef.current[peerId];
    
    if (!peer) {
      // Create new peer connection
      peer = new Peer({
        initiator: false,
        trickle: false,
        stream: localStream
      });
      
      peer.on('signal', (data) => {
        sendVideoSignal(data, peerId, roomId);
      });
      
      peer.on('stream', (remoteStream) => {
        const videoElement = remoteVideoRefs.current[peerId];
        if (videoElement) {
          videoElement.srcObject = remoteStream;
        }
        
        // Add participant
        setParticipants(prev => [
          ...prev.filter(p => p.id !== peerId),
          {
            id: peerId,
            name: `User ${peerId}`,
            email: '',
            stream: remoteStream,
            peer
          }
        ]);
      });
      
      peer.on('error', (error) => {
        console.error('Peer error:', error);
      });
      
      peersRef.current[peerId] = peer;
    }
    
    peer.signal(signal);
  };

  // Start call
  const handleStartCall = () => {
    if (!localStream) {
      toast.error('Camera/microphone not available');
      return;
    }
    
    startVideoCall(roomId, sessionId);
  };

  // End call
  const handleEndCall = () => {
    endVideoCall(roomId, sessionId);
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'h-full'}`}>
      <Card className="h-full bg-black text-white border-none">
        <CardContent className="p-0 h-full relative">
          {/* Main video area */}
          <div className="relative h-full">
            {/* Remote participants */}
            <div className="grid grid-cols-1 md:grid-cols-2 h-full">
              {participants.map((participant) => (
                <div key={participant.id} className="relative bg-gray-900">
                  <video
                    ref={(el) => {
                      if (el) remoteVideoRefs.current[participant.id] = el;
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute bottom-4 left-4">
                    <div className="flex items-center space-x-2 bg-black/50 rounded-lg px-3 py-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.image} />
                        <AvatarFallback>
                          {participant.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{participant.name}</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Show placeholder if no participants */}
              {participants.length === 0 && (
                <div className="flex items-center justify-center h-full bg-gray-900">
                  <div className="text-center">
                    <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-400">Waiting for other participants...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Local video (picture-in-picture) */}
            <div className="absolute top-4 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden border-2 border-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="text-xs">
                  You
                </Badge>
              </div>
              
              {!isVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <VideoOff className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>
          </div>
          
          {/* Call info overlay */}
          <div className="absolute top-4 left-4">
            <div className="bg-black/50 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-3">
                <Badge variant={isCallActive ? 'default' : 'secondary'}>
                  {isCallActive ? 'Connected' : 'Connecting...'}
                </Badge>
                
                {isCallActive && (
                  <span className="text-sm font-mono">
                    {formatDuration(callDuration)}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center space-x-4 bg-black/70 rounded-full px-6 py-3">
              <Button
                variant={isAudioEnabled ? 'default' : 'destructive'}
                size="lg"
                className="rounded-full h-12 w-12"
                onClick={toggleAudio}
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              
              <Button
                variant={isVideoEnabled ? 'default' : 'destructive'}
                size="lg"
                className="rounded-full h-12 w-12"
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
              
              {!isCallActive ? (
                <Button
                  variant="default"
                  size="lg"
                  className="rounded-full h-12 w-12 bg-green-600 hover:bg-green-700"
                  onClick={handleStartCall}
                >
                  <Phone className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full h-12 w-12"
                  onClick={handleEndCall}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              )}
              
              <Button
                variant="outline"
                size="lg"
                className="rounded-full h-12 w-12"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                className="rounded-full h-12 w-12"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};