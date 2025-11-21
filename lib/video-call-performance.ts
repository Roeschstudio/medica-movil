// Video call performance optimization and monitoring utilities

export interface ConnectionMetrics {
  packetsLost: number;
  packetsReceived: number;
  bytesReceived: number;
  bytesSent: number;
  jitter: number;
  roundTripTime: number;
  bandwidth: number;
  frameRate: number;
  resolution: { width: number; height: number };
}

export interface CallQualityMetrics {
  connectionEstablishmentTime: number;
  audioQuality: "excellent" | "good" | "fair" | "poor";
  videoQuality: "excellent" | "good" | "fair" | "poor";
  overallQuality: "excellent" | "good" | "fair" | "poor";
  networkCondition: "stable" | "unstable" | "poor";
  recommendations: string[];
}

export interface PerformanceConfig {
  adaptiveQuality: boolean;
  maxBitrate: number;
  minBitrate: number;
  preferredCodec: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export class VideoCallPerformanceMonitor {
  private metrics: ConnectionMetrics[] = [];
  private config: PerformanceConfig;

  constructor(config: PerformanceConfig) {
    this.config = config;
  }

  async collectMetrics(
    peerConnection: RTCPeerConnection
  ): Promise<ConnectionMetrics | null> {
    try {
      const stats = await peerConnection.getStats();
      const metrics: Partial<ConnectionMetrics> = {};

      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          metrics.packetsReceived = report.packetsReceived || 0;
          metrics.packetsLost = report.packetsLost || 0;
          metrics.bytesReceived = report.bytesReceived || 0;
          metrics.jitter = report.jitter || 0;
        }

        if (report.type === "outbound-rtp" && report.mediaType === "video") {
          metrics.bytesSent = report.bytesSent || 0;
        }

        if (report.type === "candidate-pair" && report.state === "succeeded") {
          metrics.roundTripTime = report.currentRoundTripTime || 0;
        }
      });

      const completeMetrics: ConnectionMetrics = {
        packetsLost: metrics.packetsLost || 0,
        packetsReceived: metrics.packetsReceived || 0,
        bytesReceived: metrics.bytesReceived || 0,
        bytesSent: metrics.bytesSent || 0,
        jitter: metrics.jitter || 0,
        roundTripTime: metrics.roundTripTime || 0,
        bandwidth: this.calculateBandwidth(metrics.bytesReceived || 0),
        frameRate: 30, // Default value
        resolution: { width: 1280, height: 720 }, // Default value
      };

      this.metrics.push(completeMetrics);
      return completeMetrics;
    } catch (error) {
      console.error("Error collecting metrics:", error);
      return null;
    }
  }

  private calculateBandwidth(bytesReceived: number): number {
    // Simple bandwidth calculation
    return (bytesReceived * 8) / 1000; // Convert to kbps
  }

  getQualityAssessment(): CallQualityMetrics {
    if (this.metrics.length === 0) {
      return {
        connectionEstablishmentTime: 0,
        audioQuality: "poor",
        videoQuality: "poor",
        overallQuality: "poor",
        networkCondition: "poor",
        recommendations: ["No metrics available"],
      };
    }

    const latestMetrics = this.metrics[this.metrics.length - 1];

    return {
      connectionEstablishmentTime: 1000, // Default value
      audioQuality: this.assessAudioQuality(latestMetrics),
      videoQuality: this.assessVideoQuality(latestMetrics),
      overallQuality: this.assessOverallQuality(latestMetrics),
      networkCondition: this.assessNetworkCondition(latestMetrics),
      recommendations: this.generateRecommendations(latestMetrics),
    };
  }

  private assessAudioQuality(
    metrics: ConnectionMetrics
  ): "excellent" | "good" | "fair" | "poor" {
    if (metrics.jitter < 30 && metrics.packetsLost < 1) return "excellent";
    if (metrics.jitter < 50 && metrics.packetsLost < 3) return "good";
    if (metrics.jitter < 100 && metrics.packetsLost < 5) return "fair";
    return "poor";
  }

  private assessVideoQuality(
    metrics: ConnectionMetrics
  ): "excellent" | "good" | "fair" | "poor" {
    if (metrics.bandwidth > 1000 && metrics.packetsLost < 1) return "excellent";
    if (metrics.bandwidth > 500 && metrics.packetsLost < 3) return "good";
    if (metrics.bandwidth > 200 && metrics.packetsLost < 5) return "fair";
    return "poor";
  }

  private assessOverallQuality(
    metrics: ConnectionMetrics
  ): "excellent" | "good" | "fair" | "poor" {
    const audioQuality = this.assessAudioQuality(metrics);
    const videoQuality = this.assessVideoQuality(metrics);

    if (audioQuality === "excellent" && videoQuality === "excellent")
      return "excellent";
    if (audioQuality === "good" && videoQuality === "good") return "good";
    if (audioQuality === "fair" || videoQuality === "fair") return "fair";
    return "poor";
  }

  private assessNetworkCondition(
    metrics: ConnectionMetrics
  ): "stable" | "unstable" | "poor" {
    if (metrics.jitter < 30 && metrics.roundTripTime < 100) return "stable";
    if (metrics.jitter < 100 && metrics.roundTripTime < 300) return "unstable";
    return "poor";
  }

  private generateRecommendations(metrics: ConnectionMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.packetsLost > 5) {
      recommendations.push(
        "High packet loss detected. Check network connection."
      );
    }

    if (metrics.jitter > 100) {
      recommendations.push(
        "High jitter detected. Consider using a wired connection."
      );
    }

    if (metrics.bandwidth < 200) {
      recommendations.push(
        "Low bandwidth detected. Consider reducing video quality."
      );
    }

    return recommendations;
  }
}
