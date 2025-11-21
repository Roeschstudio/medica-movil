"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface VideoSession {
  id: string;
  sessionId: string;
  roomName: string;
  type: "CONSULTATION" | "FOLLOW_UP" | "EMERGENCY";
  status: "WAITING" | "ACTIVE" | "ENDED" | "CANCELLED";
  initiatorId: string;
  recordingUrl?: string;
  duration: number;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
  chatRoom: {
    id: string;
    appointmentId: string;
    appointment: {
      id: string;
      scheduledAt: string;
      patient: {
        id: string;
        name: string;
        email: string;
      };
      doctor: {
        user: {
          id: string;
          name: string;
          email: string;
        };
        specialty: string;
        profileImage?: string;
      };
    };
  };
  participants: Array<{
    id: string;
    userId: string;
    joinedAt?: string;
    leftAt?: string;
    isConnected: boolean;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

interface UseVideoSessionOptions {
  sessionId?: string;
  chatRoomId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseVideoSessionReturn {
  session: VideoSession | null;
  loading: boolean;
  error: string | null;
  createSession: (
    chatRoomId: string,
    type?: VideoSession["type"]
  ) => Promise<VideoSession | null>;
  updateSession: (
    updates: Partial<Pick<VideoSession, "status" | "recordingUrl" | "duration">>
  ) => Promise<VideoSession | null>;
  joinSession: () => Promise<boolean>;
  leaveSession: () => Promise<boolean>;
  deleteSession: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useVideoSession(
  options: UseVideoSessionOptions = {}
): UseVideoSessionReturn {
  const {
    sessionId,
    chatRoomId,
    autoRefresh = false,
    refreshInterval = 5000,
  } = options;

  const [session, setSession] = useState<VideoSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch session data
  const fetchSession = useCallback(
    async (id?: string) => {
      if (!id && !sessionId) return;

      const targetId = id || sessionId;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/video/${targetId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setSession(null);
            return;
          }
          throw new Error(`Failed to fetch session: ${response.statusText}`);
        }

        const data = await response.json();
        setSession(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch session";
        setError(errorMessage);
        console.error("Error fetching video session:", err);
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  // Create new session
  const createSession = useCallback(
    async (
      roomId: string,
      type: VideoSession["type"] = "CONSULTATION"
    ): Promise<VideoSession | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/video/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatRoomId: roomId, type }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create session: ${response.statusText}`);
        }

        const newSession = await response.json();
        setSession(newSession);
        toast.success("Video session created successfully");
        return newSession;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create session";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Error creating video session:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Update session
  const updateSession = useCallback(
    async (
      updates: Partial<
        Pick<VideoSession, "status" | "recordingUrl" | "duration">
      >
    ): Promise<VideoSession | null> => {
      if (!session) {
        setError("No session to update");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/video/${session.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`Failed to update session: ${response.statusText}`);
        }

        const updatedSession = await response.json();
        setSession(updatedSession);
        return updatedSession;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update session";
        setError(errorMessage);
        console.error("Error updating video session:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  // Join session
  const joinSession = useCallback(async (): Promise<boolean> => {
    if (!session) {
      setError("No session to join");
      return false;
    }

    try {
      const response = await fetch(
        `/api/video/${session.sessionId}/participants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join" }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to join session: ${response.statusText}`);
      }

      // Refresh session data to get updated participant info
      await fetchSession(session.sessionId);
      toast.success("Joined video session");
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to join session";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error joining video session:", err);
      return false;
    }
  }, [session, fetchSession]);

  // Leave session
  const leaveSession = useCallback(async (): Promise<boolean> => {
    if (!session) {
      setError("No session to leave");
      return false;
    }

    try {
      const response = await fetch(
        `/api/video/${session.sessionId}/participants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "leave" }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to leave session: ${response.statusText}`);
      }

      // Refresh session data to get updated participant info
      await fetchSession(session.sessionId);
      toast.success("Left video session");
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to leave session";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error leaving video session:", err);
      return false;
    }
  }, [session, fetchSession]);

  // Delete session
  const deleteSession = useCallback(async (): Promise<boolean> => {
    if (!session) {
      setError("No session to delete");
      return false;
    }

    try {
      const response = await fetch(`/api/video/${session.sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
      }

      setSession(null);
      toast.success("Video session deleted");
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete session";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error deleting video session:", err);
      return false;
    }
  }, [session]);

  // Refresh session data
  const refresh = useCallback(async () => {
    if (sessionId) {
      await fetchSession(sessionId);
    }
  }, [sessionId, fetchSession]);

  // Fetch session by chat room ID
  const fetchSessionByChatRoom = useCallback(async (roomId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/video/session?chatRoomId=${roomId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setSession(null);
          return;
        }
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }

      const sessions = await response.json();
      if (Array.isArray(sessions) && sessions.length > 0) {
        setSession(sessions[0]); // Get the most recent session
      } else {
        setSession(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch session";
      setError(errorMessage);
      console.error("Error fetching video session by chat room:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize
  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
    } else if (chatRoomId) {
      fetchSessionByChatRoom(chatRoomId);
    }
  }, [sessionId, chatRoomId, fetchSession, fetchSessionByChatRoom]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && (sessionId || chatRoomId)) {
      refreshIntervalRef.current = setInterval(() => {
        if (sessionId) {
          fetchSession(sessionId);
        } else if (chatRoomId) {
          fetchSessionByChatRoom(chatRoomId);
        }
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [
    autoRefresh,
    sessionId,
    chatRoomId,
    refreshInterval,
    fetchSession,
    fetchSessionByChatRoom,
  ]);

  return {
    session,
    loading,
    error,
    createSession,
    updateSession,
    joinSession,
    leaveSession,
    deleteSession,
    refresh,
  };
}
