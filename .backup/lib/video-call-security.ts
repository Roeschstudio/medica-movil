// Video call security and authentication utilities

export interface VideoCallPermissions {
  canInitiateCalls: boolean;
  canReceiveCalls: boolean;
  canAccessRoom: boolean;
  relationshipVerified: boolean;
}

export class VideoCallSecurity {
  private supabase = createSupabaseBrowserClient();

  // Verify user authentication and permissions for video calls
  async verifyCallPermissions(
    userId: string,
    roomId: string,
    receiverId: string
  ): Promise<VideoCallPermissions> {
    try {
      // Check if user is authenticated
      const {
        data: { user },
        error: authError,
      } = await this.supabase.auth.getUser();

      if (authError || !user || user.id !== userId) {
        return {
          canInitiateCalls: false,
          canReceiveCalls: false,
          canAccessRoom: false,
          relationshipVerified: false,
        };
      }

      // Verify room access
      const roomAccess = await this.verifyRoomAccess(userId, roomId);
      if (!roomAccess) {
        return {
          canInitiateCalls: false,
          canReceiveCalls: false,
          canAccessRoom: false,
          relationshipVerified: false,
        };
      }

      // Verify relationship between users
      const relationshipVerified = await this.verifyUserRelationship(
        userId,
        receiverId
      );

      return {
        canInitiateCalls: relationshipVerified,
        canReceiveCalls: relationshipVerified,
        canAccessRoom: roomAccess,
        relationshipVerified,
      };
    } catch (error) {
      console.error("Error verifying call permissions:", error);
      return {
        canInitiateCalls: false,
        canReceiveCalls: false,
        canAccessRoom: false,
        relationshipVerified: false,
      };
    }
  }

  // Verify user has access to the chat room
  private async verifyRoomAccess(
    userId: string,
    roomId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("chat_rooms")
        .select("id, doctor_id, patient_id")
        .eq("id", roomId)
        .single();

      if (error || !data) {
        return false;
      }

      // User must be either the doctor or patient in the room
      return data.doctor_id === userId || data.patient_id === userId;
    } catch (error) {
      console.error("Error verifying room access:", error);
      return false;
    }
  }

  // Verify relationship between users (doctor-patient relationship)
  private async verifyUserRelationship(
    userId: string,
    otherUserId: string
  ): Promise<boolean> {
    try {
      // Check if there's an active appointment between these users
      const { data, error } = await this.supabase
        .from("appointments")
        .select("id, doctor_id, patient_id, status")
        .or(
          `and(doctor_id.eq.${userId},patient_id.eq.${otherUserId}),and(doctor_id.eq.${otherUserId},patient_id.eq.${userId})`
        )
        .in("status", ["scheduled", "in_progress", "completed"])
        .limit(1);

      if (error) {
        console.error("Error verifying user relationship:", error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error("Error verifying user relationship:", error);
      return false;
    }
  }

  // Validate JWT token for video call operations
  async validateCallToken(callId: string): Promise<boolean> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();

      if (error || !user) {
        return false;
      }

      // Verify the user is part of the call
      const { data: call, error: callError } = await this.supabase
        .from("video_calls")
        .select("caller_id, receiver_id")
        .eq("id", callId)
        .single();

      if (callError || !call) {
        return false;
      }

      return call.caller_id === user.id || call.receiver_id === user.id;
    } catch (error) {
      console.error("Error validating call token:", error);
      return false;
    }
  }

  // Check if the current context is secure (HTTPS)
  static isSecureContext(): boolean {
    if (typeof window === "undefined") {
      return true; // Server-side is considered secure
    }

    // Allow localhost for development
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return true;
    }

    // Require HTTPS for all other contexts
    return window.location.protocol === "https:";
  }

  // Validate secure context for WebRTC
  static validateSecureContext(): { isSecure: boolean; message?: string } {
    if (!this.isSecureContext()) {
      return {
        isSecure: false,
        message:
          "Video calls require a secure HTTPS connection. Please access the site using HTTPS.",
      };
    }

    return { isSecure: true };
  }

  // Sanitize and validate call metadata
  static sanitizeCallMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== "object") {
      return {};
    }

    const sanitized: any = {};
    const allowedFields = [
      "call_quality",
      "connection_type",
      "browser_info",
      "device_info",
      "network_info",
    ];

    for (const field of allowedFields) {
      if (metadata[field] !== undefined) {
        // Basic sanitization - remove any potential script content
        if (typeof metadata[field] === "string") {
          sanitized[field] = metadata[field]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .substring(0, 1000); // Limit length
        } else if (
          typeof metadata[field] === "object" &&
          metadata[field] !== null
        ) {
          // Recursively sanitize nested objects
          sanitized[field] = this.sanitizeCallMetadata(metadata[field]);
        } else {
          sanitized[field] = metadata[field];
        }
      }
    }

    return sanitized;
  }

  // Rate limiting for call operations
  private static callAttempts = new Map<
    string,
    { count: number; lastAttempt: number }
  >();

  static checkRateLimit(
    userId: string,
    operation: "start_call" | "answer_call" | "signal"
  ): boolean {
    const now = Date.now();
    const key = `${userId}:${operation}`;
    const existing = this.callAttempts.get(key);

    // Rate limits per operation type
    const limits = {
      start_call: { maxAttempts: 5, windowMs: 60000 }, // 5 calls per minute
      answer_call: { maxAttempts: 10, windowMs: 60000 }, // 10 answers per minute
      signal: { maxAttempts: 100, windowMs: 60000 }, // 100 signals per minute
    };

    const limit = limits[operation];

    if (!existing) {
      this.callAttempts.set(key, { count: 1, lastAttempt: now });
      return true;
    }

    // Reset counter if window has passed
    if (now - existing.lastAttempt > limit.windowMs) {
      this.callAttempts.set(key, { count: 1, lastAttempt: now });
      return true;
    }

    // Check if under limit
    if (existing.count < limit.maxAttempts) {
      existing.count++;
      existing.lastAttempt = now;
      return true;
    }

    return false;
  }

  // Clean up old rate limit entries
  static cleanupRateLimits(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [key, data] of this.callAttempts.entries()) {
      if (now - data.lastAttempt > maxAge) {
        this.callAttempts.delete(key);
      }
    }
  }

  // Audit logging for video call events (privacy-preserving)
  async logCallEvent(
    eventType: "call_started" | "call_answered" | "call_ended" | "call_failed",
    callId: string,
    userId: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Only log essential information for security auditing
      const auditData = {
        event_type: eventType,
        call_id: callId,
        user_id: userId,
        timestamp: new Date().toISOString(),
        metadata: this.sanitizeCallMetadata(metadata),
        ip_hash: await this.hashIP(), // Hash IP for privacy
      };

      // In a real implementation, you might want to use a separate audit table
      // For now, we'll just log to console in development
      if (process.env.NODE_ENV === "development") {
        console.log("Video call audit event:", auditData);
      }

      // In production, send to audit logging service
      // await this.sendToAuditService(auditData);
    } catch (error) {
      console.error("Error logging call event:", error);
    }
  }

  // Hash IP address for privacy-preserving logging
  private async hashIP(): Promise<string> {
    try {
      // In a real implementation, you'd get the actual IP from the request
      // For client-side, we'll just return a placeholder
      return "client_side_hash";
    } catch (error) {
      return "unknown";
    }
  }

  // Validate WebRTC signal data for security
  static validateSignalData(signalType: string, signalData: any): boolean {
    try {
      switch (signalType) {
        case "offer":
        case "answer":
          return (
            signalData &&
            typeof signalData.type === "string" &&
            typeof signalData.sdp === "string" &&
            signalData.sdp.length < 10000 // Reasonable SDP size limit
          );

        case "ice_candidate":
          return (
            signalData &&
            typeof signalData.candidate === "string" &&
            typeof signalData.sdpMLineIndex === "number" &&
            signalData.candidate.length < 1000 // Reasonable candidate size limit
          );

        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  // Session management for active calls
  private static activeSessions = new Map<
    string,
    { userId: string; startTime: number; lastActivity: number }
  >();

  static createSession(callId: string, userId: string): void {
    const now = Date.now();
    this.activeSessions.set(callId, {
      userId,
      startTime: now,
      lastActivity: now,
    });
  }

  static updateSessionActivity(callId: string): void {
    const session = this.activeSessions.get(callId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  static validateSession(callId: string, userId: string): boolean {
    const session = this.activeSessions.get(callId);
    if (!session) {
      return false;
    }

    // Check if session belongs to user
    if (session.userId !== userId) {
      return false;
    }

    // Check if session is still active (within 1 hour)
    const maxSessionAge = 3600000; // 1 hour
    const now = Date.now();

    if (now - session.lastActivity > maxSessionAge) {
      this.activeSessions.delete(callId);
      return false;
    }

    return true;
  }

  static endSession(callId: string): void {
    this.activeSessions.delete(callId);
  }

  // Clean up old sessions
  static cleanupSessions(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [callId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > maxAge) {
        this.activeSessions.delete(callId);
      }
    }
  }
}

// Initialize cleanup intervals
if (typeof window !== "undefined") {
  // Clean up rate limits every 5 minutes
  setInterval(() => {
    VideoCallSecurity.cleanupRateLimits();
  }, 300000);

  // Clean up sessions every 10 minutes
  setInterval(() => {
    VideoCallSecurity.cleanupSessions();
  }, 600000);
}
