// Video call error types and handling utilities

export enum VideoCallErrorType {
  WEBRTC_NOT_SUPPORTED = "WEBRTC_NOT_SUPPORTED",
  MEDIA_ACCESS_DENIED = "MEDIA_ACCESS_DENIED",
  MEDIA_DEVICE_NOT_FOUND = "MEDIA_DEVICE_NOT_FOUND",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  SIGNALING_FAILED = "SIGNALING_FAILED",
  NETWORK_ERROR = "NETWORK_ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  BROWSER_INCOMPATIBLE = "BROWSER_INCOMPATIBLE",
  HTTPS_REQUIRED = "HTTPS_REQUIRED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface VideoCallError extends Error {
  type: VideoCallErrorType;
  code?: string;
  recoverable: boolean;
  userMessage: string;
  technicalMessage: string;
  recoveryActions: string[];
}

export class VideoCallErrorHandler {
  static createError(
    type: VideoCallErrorType,
    originalError?: Error,
    context?: string
  ): VideoCallError {
    const errorInfo = this.getErrorInfo(type);

    const error = new Error(errorInfo.userMessage) as VideoCallError;
    error.type = type;
    error.recoverable = errorInfo.recoverable;
    error.userMessage = errorInfo.userMessage;
    error.technicalMessage =
      originalError?.message || errorInfo.technicalMessage;
    error.recoveryActions = errorInfo.recoveryActions;

    if (originalError) {
      error.stack = originalError.stack;
      error.cause = originalError;
    }

    return error;
  }

  private static getErrorInfo(type: VideoCallErrorType) {
    switch (type) {
      case VideoCallErrorType.WEBRTC_NOT_SUPPORTED:
        return {
          recoverable: false,
          userMessage: "Video calls are not supported in your browser",
          technicalMessage: "WebRTC APIs not available",
          recoveryActions: [
            "Use a modern browser like Chrome, Firefox, or Safari",
            "Update your browser to the latest version",
            "Enable WebRTC in browser settings if disabled",
          ],
        };

      case VideoCallErrorType.MEDIA_ACCESS_DENIED:
        return {
          recoverable: true,
          userMessage:
            "Camera and microphone access is required for video calls",
          technicalMessage: "getUserMedia permission denied",
          recoveryActions: [
            "Click the camera icon in your browser's address bar",
            "Select 'Allow' for camera and microphone permissions",
            "Refresh the page and try again",
            "Check your browser's privacy settings",
          ],
        };

      case VideoCallErrorType.MEDIA_DEVICE_NOT_FOUND:
        return {
          recoverable: true,
          userMessage: "No camera or microphone found",
          technicalMessage: "No media devices available",
          recoveryActions: [
            "Connect a camera and/or microphone to your device",
            "Check that your devices are properly connected",
            "Restart your browser and try again",
            "Check device permissions in system settings",
          ],
        };

      case VideoCallErrorType.CONNECTION_FAILED:
        return {
          recoverable: true,
          userMessage: "Failed to establish video call connection",
          technicalMessage: "WebRTC peer connection failed",
          recoveryActions: [
            "Check your internet connection",
            "Try again in a few moments",
            "Disable VPN or proxy if using one",
            "Contact support if the problem persists",
          ],
        };

      case VideoCallErrorType.SIGNALING_FAILED:
        return {
          recoverable: true,
          userMessage: "Unable to coordinate the video call",
          technicalMessage: "Signaling server communication failed",
          recoveryActions: [
            "Check your internet connection",
            "Refresh the page and try again",
            "Try again in a few moments",
            "Contact support if the problem persists",
          ],
        };

      case VideoCallErrorType.NETWORK_ERROR:
        return {
          recoverable: true,
          userMessage: "Network connection issues detected",
          technicalMessage: "Network connectivity problems",
          recoveryActions: [
            "Check your internet connection",
            "Try switching to a different network",
            "Disable other bandwidth-heavy applications",
            "Try again when your connection is more stable",
          ],
        };

      case VideoCallErrorType.PERMISSION_DENIED:
        return {
          recoverable: true,
          userMessage: "Permission denied for video call features",
          technicalMessage:
            "Insufficient permissions for video call operations",
          recoveryActions: [
            "Check your account permissions",
            "Contact your administrator if needed",
            "Try logging out and back in",
            "Contact support for assistance",
          ],
        };

      case VideoCallErrorType.BROWSER_INCOMPATIBLE:
        return {
          recoverable: false,
          userMessage: "Your browser doesn't fully support video calls",
          technicalMessage: "Browser lacks required WebRTC features",
          recoveryActions: [
            "Use Chrome, Firefox, Safari, or Edge",
            "Update your browser to the latest version",
            "Enable hardware acceleration in browser settings",
            "Try using a different device",
          ],
        };

      case VideoCallErrorType.HTTPS_REQUIRED:
        return {
          recoverable: false,
          userMessage: "Video calls require a secure connection",
          technicalMessage: "HTTPS required for WebRTC media access",
          recoveryActions: [
            "Access the site using HTTPS",
            "Contact support if you see this error in production",
            "For development, use localhost or a tunneling service",
          ],
        };

      default:
        return {
          recoverable: true,
          userMessage: "An unexpected error occurred during the video call",
          technicalMessage: "Unknown video call error",
          recoveryActions: [
            "Try again in a few moments",
            "Refresh the page",
            "Check your internet connection",
            "Contact support if the problem persists",
          ],
        };
    }
  }

  static detectErrorType(error: Error): VideoCallErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // WebRTC not supported
    if (typeof window !== "undefined" && !window.RTCPeerConnection) {
      return VideoCallErrorType.WEBRTC_NOT_SUPPORTED;
    }

    // HTTPS required
    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost"
    ) {
      return VideoCallErrorType.HTTPS_REQUIRED;
    }

    // Media access errors
    if (
      name.includes("notallowederror") ||
      message.includes("permission denied")
    ) {
      return VideoCallErrorType.MEDIA_ACCESS_DENIED;
    }

    if (
      name.includes("notfounderror") ||
      message.includes("device not found")
    ) {
      return VideoCallErrorType.MEDIA_DEVICE_NOT_FOUND;
    }

    // Connection errors
    if (
      message.includes("connection failed") ||
      message.includes("ice connection failed")
    ) {
      return VideoCallErrorType.CONNECTION_FAILED;
    }

    // Network errors
    if (message.includes("network") || message.includes("timeout")) {
      return VideoCallErrorType.NETWORK_ERROR;
    }

    // Signaling errors
    if (message.includes("signaling") || message.includes("supabase")) {
      return VideoCallErrorType.SIGNALING_FAILED;
    }

    return VideoCallErrorType.UNKNOWN_ERROR;
  }

  static isRecoverable(error: VideoCallError | Error): boolean {
    if ("recoverable" in error) {
      return error.recoverable;
    }

    const type = this.detectErrorType(error);
    const errorInfo = this.getErrorInfo(type);
    return errorInfo.recoverable;
  }

  static getRecoveryActions(error: VideoCallError | Error): string[] {
    if ("recoveryActions" in error) {
      return error.recoveryActions;
    }

    const type = this.detectErrorType(error);
    const errorInfo = this.getErrorInfo(type);
    return errorInfo.recoveryActions;
  }

  static getUserMessage(error: VideoCallError | Error): string {
    if ("userMessage" in error) {
      return error.userMessage;
    }

    const type = this.detectErrorType(error);
    const errorInfo = this.getErrorInfo(type);
    return errorInfo.userMessage;
  }
}

// WebRTC compatibility detection
export class WebRTCCompatibility {
  static isSupported(): boolean {
    return !!(
      window.RTCPeerConnection &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
  }

  static getCompatibilityReport(): {
    supported: boolean;
    features: {
      rtcPeerConnection: boolean;
      getUserMedia: boolean;
      mediaDevices: boolean;
      webRTC: boolean;
    };
    browser: string;
    recommendations: string[];
  } {
    const features = {
      rtcPeerConnection: !!window.RTCPeerConnection,
      getUserMedia: !!(
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ),
      mediaDevices: !!navigator.mediaDevices,
      webRTC: !!window.RTCPeerConnection,
    };

    const supported = Object.values(features).every(Boolean);

    const userAgent = navigator.userAgent;
    let browser = "Unknown";

    if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Safari")) browser = "Safari";
    else if (userAgent.includes("Edge")) browser = "Edge";

    const recommendations = [];

    if (!supported) {
      recommendations.push(
        "Use a modern browser like Chrome, Firefox, Safari, or Edge"
      );
      recommendations.push("Update your browser to the latest version");

      if (!features.rtcPeerConnection) {
        recommendations.push("Enable WebRTC in your browser settings");
      }

      if (!features.getUserMedia) {
        recommendations.push("Enable media access permissions");
      }
    }

    return {
      supported,
      features,
      browser,
      recommendations,
    };
  }
}

// Connection quality monitoring
export class ConnectionQualityMonitor {
  private peerConnection: RTCPeerConnection | null = null;
  private qualityCallback: ((quality: ConnectionQuality) => void) | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(peerConnection: RTCPeerConnection) {
    this.peerConnection = peerConnection;
  }

  startMonitoring(callback: (quality: ConnectionQuality) => void): void {
    this.qualityCallback = callback;

    this.monitoringInterval = setInterval(async () => {
      if (this.peerConnection && this.qualityCallback) {
        const quality = await this.measureConnectionQuality();
        this.qualityCallback(quality);
      }
    }, 2000);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.qualityCallback = null;
  }

  private async measureConnectionQuality(): Promise<ConnectionQuality> {
    if (!this.peerConnection) {
      return { level: "unknown", metrics: {} };
    }

    try {
      const stats = await this.peerConnection.getStats();
      const metrics: ConnectionMetrics = {};

      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          metrics.packetsLost = report.packetsLost || 0;
          metrics.packetsReceived = report.packetsReceived || 0;
          metrics.bytesReceived = report.bytesReceived || 0;
          metrics.jitter = report.jitter || 0;
        }

        if (report.type === "candidate-pair" && report.state === "succeeded") {
          metrics.roundTripTime = report.currentRoundTripTime || 0;
        }
      });

      const level = this.calculateQualityLevel(metrics);

      return { level, metrics };
    } catch (error) {
      console.warn("Failed to measure connection quality:", error);
      return { level: "unknown", metrics: {} };
    }
  }

  private calculateQualityLevel(
    metrics: ConnectionMetrics
  ): ConnectionQualityLevel {
    const { packetsLost = 0, packetsReceived = 0, roundTripTime = 0 } = metrics;

    const lossRate = packetsReceived > 0 ? packetsLost / packetsReceived : 0;
    const rtt = roundTripTime * 1000; // Convert to milliseconds

    if (lossRate > 0.05 || rtt > 500) {
      return "poor";
    } else if (lossRate > 0.02 || rtt > 200) {
      return "fair";
    } else if (lossRate > 0.01 || rtt > 100) {
      return "good";
    } else {
      return "excellent";
    }
  }
}

export interface ConnectionMetrics {
  packetsLost?: number;
  packetsReceived?: number;
  bytesReceived?: number;
  jitter?: number;
  roundTripTime?: number;
}

export type ConnectionQualityLevel =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "unknown";

export interface ConnectionQuality {
  level: ConnectionQualityLevel;
  metrics: ConnectionMetrics;
}
