/**
 * Video Call Monitoring and Analytics Service
 * Tracks performance metrics, call quality, and usage analytics
 */

// Call quality metrics interface
export interface CallQualityMetrics {
  callId: string;
  userId: string;
  connectionTime: number;
  iceGatheringTime: number;
  audioQuality: {
    bitrate: number;
    packetLoss: number;
    jitter: number;
    roundTripTime: number;
  };
  videoQuality: {
    bitrate: number;
    packetLoss: number;
    jitter: number;
    frameRate: number;
    resolution: string;
  };
  networkConditions: {
    bandwidth: number;
    latency: number;
    connectionType: string;
  };
  timestamp: string;
}

// Usage analytics interface
export interface CallUsageAnalytics {
  callId: string;
  userId: string;
  userRole: "doctor" | "patient";
  callDuration: number;
  callType: "video" | "audio";
  endReason: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    browser: string;
    browserVersion: string;
  };
  features: {
    cameraToggled: number;
    microphoneToggled: number;
    fullscreenUsed: boolean;
    qualityAdjustments: number;
  };
  timestamp: string;
}

// Error tracking interface
export interface CallErrorEvent {
  callId?: string;
  userId: string;
  errorType: "connection" | "media" | "signaling" | "permission" | "browser";
  errorMessage: string;
  errorStack?: string;
  context: {
    userAgent: string;
    url: string;
    timestamp: string;
    additionalData?: Record<string, any>;
  };
}

// System health metrics
export interface SystemHealthMetrics {
  timestamp: string;
  activeCalls: number;
  totalCallsToday: number;
  averageCallDuration: number;
  successRate: number;
  errorRate: number;
  performanceMetrics: {
    averageConnectionTime: number;
    averageIceGatheringTime: number;
    averageAudioQuality: number;
    averageVideoQuality: number;
  };
}

export class VideoCallMonitoring {
  private supabase: any;
  private metricsBuffer: CallQualityMetrics[] = [];
  private analyticsBuffer: CallUsageAnalytics[] = [];
  private errorBuffer: CallErrorEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 10;
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
    this.startPeriodicFlush();
  }

  // Track call quality metrics
  async trackCallQuality(metrics: CallQualityMetrics): Promise<void> {
    try {
      // Add to buffer
      this.metricsBuffer.push(metrics);

      // Flush if buffer is full
      if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
        await this.flushMetrics();
      }
    } catch (error) {
      console.error("Failed to track call quality metrics:", error);
    }
  }

  // Track usage analytics
  async trackUsageAnalytics(analytics: CallUsageAnalytics): Promise<void> {
    try {
      // Add to buffer
      this.analyticsBuffer.push(analytics);

      // Flush if buffer is full
      if (this.analyticsBuffer.length >= this.BUFFER_SIZE) {
        await this.flushAnalytics();
      }
    } catch (error) {
      console.error("Failed to track usage analytics:", error);
    }
  }

  // Track error events
  async trackError(error: CallErrorEvent): Promise<void> {
    try {
      // Add to buffer
      this.errorBuffer.push(error);

      // Flush errors immediately for critical issues
      if (error.errorType === "connection" || error.errorType === "media") {
        await this.flushErrors();
      } else if (this.errorBuffer.length >= this.BUFFER_SIZE) {
        await this.flushErrors();
      }
    } catch (err) {
      console.error("Failed to track error event:", err);
    }
  }

  // Start periodic buffer flushing
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushAllBuffers();
    }, this.FLUSH_INTERVAL_MS);
  }

  // Flush all buffers
  private async flushAllBuffers(): Promise<void> {
    await Promise.all([
      this.flushMetrics(),
      this.flushAnalytics(),
      this.flushErrors(),
    ]);
  }

  // Flush metrics buffer
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer = [];

      const { error } = await this.supabase
        .from("video_call_quality_metrics")
        .insert(metrics);

      if (error) {
        console.error("Failed to flush quality metrics:", error);
        // Re-add to buffer for retry
        this.metricsBuffer.unshift(...metrics);
      }
    } catch (error) {
      console.error("Error flushing metrics:", error);
    }
  }

  // Flush analytics buffer
  private async flushAnalytics(): Promise<void> {
    if (this.analyticsBuffer.length === 0) return;

    try {
      const analytics = [...this.analyticsBuffer];
      this.analyticsBuffer = [];

      const { error } = await this.supabase
        .from("video_call_usage_analytics")
        .insert(analytics);

      if (error) {
        console.error("Failed to flush usage analytics:", error);
        // Re-add to buffer for retry
        this.analyticsBuffer.unshift(...analytics);
      }
    } catch (error) {
      console.error("Error flushing analytics:", error);
    }
  }

  // Flush errors buffer
  private async flushErrors(): Promise<void> {
    if (this.errorBuffer.length === 0) return;

    try {
      const errors = [...this.errorBuffer];
      this.errorBuffer = [];

      const { error } = await this.supabase
        .from("video_call_error_events")
        .insert(errors);

      if (error) {
        console.error("Failed to flush error events:", error);
        // Re-add to buffer for retry
        this.errorBuffer.unshift(...errors);
      }
    } catch (error) {
      console.error("Error flushing errors:", error);
    }
  }

  // Get system health metrics
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Get active calls count
      const { data: activeCalls, error: activeError } = await this.supabase
        .from("video_calls")
        .select("id")
        .eq("status", "active");

      if (activeError) throw activeError;

      // Get today's calls
      const { data: todayCalls, error: todayError } = await this.supabase
        .from("video_calls")
        .select("id, duration_seconds, status")
        .gte("started_at", `${today}T00:00:00.000Z`)
        .lt("started_at", `${today}T23:59:59.999Z`);

      if (todayError) throw todayError;

      // Calculate metrics
      const totalCallsToday = todayCalls?.length || 0;
      const completedCalls =
        todayCalls?.filter((call) => call.status === "ended") || [];
      const averageCallDuration =
        completedCalls.length > 0
          ? completedCalls.reduce(
              (sum, call) => sum + (call.duration_seconds || 0),
              0
            ) / completedCalls.length
          : 0;

      const successfulCalls =
        todayCalls?.filter(
          (call) => call.status === "ended" || call.status === "active"
        ) || [];
      const successRate =
        totalCallsToday > 0 ? successfulCalls.length / totalCallsToday : 0;
      const errorRate = 1 - successRate;

      // Get performance metrics from quality data
      const { data: qualityMetrics, error: qualityError } = await this.supabase
        .from("video_call_quality_metrics")
        .select(
          "connection_time, ice_gathering_time, audio_quality, video_quality"
        )
        .gte("timestamp", `${today}T00:00:00.000Z`)
        .lt("timestamp", `${today}T23:59:59.999Z`);

      if (qualityError) throw qualityError;

      const performanceMetrics = this.calculatePerformanceAverages(
        qualityMetrics || []
      );

      return {
        timestamp: new Date().toISOString(),
        activeCalls: activeCalls?.length || 0,
        totalCallsToday,
        averageCallDuration,
        successRate,
        errorRate,
        performanceMetrics,
      };
    } catch (error) {
      console.error("Failed to get system health metrics:", error);
      throw error;
    }
  }

  // Calculate performance averages
  private calculatePerformanceAverages(
    metrics: any[]
  ): SystemHealthMetrics["performanceMetrics"] {
    if (metrics.length === 0) {
      return {
        averageConnectionTime: 0,
        averageIceGatheringTime: 0,
        averageAudioQuality: 0,
        averageVideoQuality: 0,
      };
    }

    const totals = metrics.reduce(
      (acc, metric) => {
        acc.connectionTime += metric.connection_time || 0;
        acc.iceGatheringTime += metric.ice_gathering_time || 0;
        acc.audioQuality += this.calculateAudioQualityScore(
          metric.audio_quality
        );
        acc.videoQuality += this.calculateVideoQualityScore(
          metric.video_quality
        );
        return acc;
      },
      {
        connectionTime: 0,
        iceGatheringTime: 0,
        audioQuality: 0,
        videoQuality: 0,
      }
    );

    return {
      averageConnectionTime: totals.connectionTime / metrics.length,
      averageIceGatheringTime: totals.iceGatheringTime / metrics.length,
      averageAudioQuality: totals.audioQuality / metrics.length,
      averageVideoQuality: totals.videoQuality / metrics.length,
    };
  }

  // Calculate audio quality score (0-100)
  private calculateAudioQualityScore(audioQuality: any): number {
    if (!audioQuality) return 0;

    const { bitrate, packetLoss, jitter, roundTripTime } = audioQuality;

    // Normalize metrics to 0-100 scale
    const bitrateScore = Math.min(((bitrate || 0) / 64000) * 100, 100); // 64kbps = 100%
    const packetLossScore = Math.max(100 - (packetLoss || 0) * 1000, 0); // 0% loss = 100%
    const jitterScore = Math.max(100 - (jitter || 0) * 1000, 0); // Low jitter = high score
    const rttScore = Math.max(100 - (roundTripTime || 0) / 10, 0); // Low RTT = high score

    return (bitrateScore + packetLossScore + jitterScore + rttScore) / 4;
  }

  // Calculate video quality score (0-100)
  private calculateVideoQualityScore(videoQuality: any): number {
    if (!videoQuality) return 0;

    const { bitrate, packetLoss, jitter, frameRate } = videoQuality;

    // Normalize metrics to 0-100 scale
    const bitrateScore = Math.min(((bitrate || 0) / 1000000) * 100, 100); // 1Mbps = 100%
    const packetLossScore = Math.max(100 - (packetLoss || 0) * 1000, 0); // 0% loss = 100%
    const jitterScore = Math.max(100 - (jitter || 0) * 1000, 0); // Low jitter = high score
    const frameRateScore = Math.min(((frameRate || 0) / 30) * 100, 100); // 30fps = 100%

    return (bitrateScore + packetLossScore + jitterScore + frameRateScore) / 4;
  }

  // Get call analytics for a specific period
  async getCallAnalytics(
    startDate: string,
    endDate: string
  ): Promise<{
    totalCalls: number;
    averageDuration: number;
    callsByType: Record<string, number>;
    callsByRole: Record<string, number>;
    successRate: number;
    topEndReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      const { data: calls, error } = await this.supabase
        .from("video_call_usage_analytics")
        .select("*")
        .gte("timestamp", startDate)
        .lte("timestamp", endDate);

      if (error) throw error;

      if (!calls || calls.length === 0) {
        return {
          totalCalls: 0,
          averageDuration: 0,
          callsByType: {},
          callsByRole: {},
          successRate: 0,
          topEndReasons: [],
        };
      }

      // Calculate analytics
      const totalCalls = calls.length;
      const averageDuration =
        calls.reduce((sum, call) => sum + call.call_duration, 0) / totalCalls;

      const callsByType = calls.reduce((acc, call) => {
        acc[call.call_type] = (acc[call.call_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const callsByRole = calls.reduce((acc, call) => {
        acc[call.user_role] = (acc[call.user_role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const successfulCalls = calls.filter(
        (call) =>
          call.end_reason === "user_ended" || call.end_reason === "completed"
      );
      const successRate = successfulCalls.length / totalCalls;

      const endReasonCounts = calls.reduce((acc, call) => {
        acc[call.end_reason] = (acc[call.end_reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topEndReasons = Object.entries(endReasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalCalls,
        averageDuration,
        callsByType,
        callsByRole,
        successRate,
        topEndReasons,
      };
    } catch (error) {
      console.error("Failed to get call analytics:", error);
      throw error;
    }
  }

  // Create device info object
  static createDeviceInfo(): CallUsageAnalytics["deviceInfo"] {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    // Simple browser detection
    let browser = "Unknown";
    let browserVersion = "Unknown";

    if (userAgent.includes("Chrome")) {
      browser = "Chrome";
      const match = userAgent.match(/Chrome\/(\d+)/);
      browserVersion = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Firefox")) {
      browser = "Firefox";
      const match = userAgent.match(/Firefox\/(\d+)/);
      browserVersion = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Safari")) {
      browser = "Safari";
      const match = userAgent.match(/Version\/(\d+)/);
      browserVersion = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Edge")) {
      browser = "Edge";
      const match = userAgent.match(/Edge\/(\d+)/);
      browserVersion = match ? match[1] : "Unknown";
    }

    return {
      userAgent,
      platform,
      browser,
      browserVersion,
    };
  }

  // Cleanup resources
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining data
    this.flushAllBuffers().catch((error) => {
      console.error("Error flushing buffers during cleanup:", error);
    });
  }
}
