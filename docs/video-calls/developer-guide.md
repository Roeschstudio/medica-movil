# Video Call System Developer Guide

## Architecture Overview

The video call system is built with a modular architecture that separates concerns and provides clear interfaces between components.

### Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Video Call System                        │
├─────────────────────────────────────────────────────────────┤
│  UI Layer                                                   │
│  ├── VideoCallInterface (React Component)                   │
│  ├── useVideoCall (React Hook)                             │
│  └── Lazy Loading Components                               │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                              │
│  ├── VideoCallService (Core WebRTC Logic)                  │
│  ├── VideoCallSecurity (Auth & Security)                   │
│  ├── VideoCallMonitoring (Analytics & Metrics)             │
│  └── VideoCallLazyLoader (Performance)                     │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ├── Supabase (Database & Realtime)                        │
│  ├── WebRTC Signaling                                      │
│  └── Monitoring Tables                                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → React Hook → Service Layer → WebRTC/Database → Real-time Updates
     ↑                                                              ↓
UI Updates ←─────────────── Event System ←─────────────── Monitoring
```

## Core Components

### VideoCallService

The main service class that handles all WebRTC operations.

#### Key Responsibilities

1. **WebRTC Management**: Peer connection setup, media stream handling
2. **Signaling**: WebRTC signal exchange through Supabase
3. **Call Lifecycle**: Start, answer, end call operations
4. **Performance**: Adaptive quality, connection pooling, signal batching
5. **Monitoring**: Metrics collection and error tracking

#### Class Structure

```typescript
export class VideoCallService {
  // Core WebRTC properties
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  // Performance optimization properties
  private connectionPool: Map<string, RTCPeerConnection> = new Map();
  private signalBatch: Array<{ type: string; data: any; timestamp: number }> =
    [];
  private connectionMetrics: ConnectionMetrics = {
    /* ... */
  };

  // Monitoring and analytics
  private monitoring: VideoCallMonitoring;
  private featureUsage = {
    /* ... */
  };

  // Event system
  private eventListeners: ((event: VideoCallEvent) => void)[] = [];
}
```

#### Key Methods

```typescript
// Call lifecycle
async startCall(roomId: string, receiverId: string, callType?: CallType): Promise<VideoCall>
async answerCall(callId: string, accept: boolean): Promise<void>
async endCall(reason?: string): Promise<void>

// Media control
async acquireMediaStream(constraints?: MediaStreamConstraints): Promise<MediaStream>
toggleCamera(): boolean
toggleMicrophone(): boolean

// WebRTC operations
async createOffer(): Promise<RTCSessionDescriptionInit>
async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>
async handleIceCandidate(candidateData: any): Promise<void>

// Performance optimization
setAdaptiveQuality(enabled: boolean): void
async setManualVideoQuality(quality: string): Promise<void>
getConnectionMetrics(): ConnectionMetrics

// Event system
addEventListener(listener: (event: VideoCallEvent) => void): void
removeEventListener(listener: (event: VideoCallEvent) => void): void
```

### VideoCallMonitoring

Handles performance monitoring, analytics, and error tracking.

#### Key Features

1. **Call Quality Metrics**: Connection time, bandwidth, packet loss, jitter
2. **Usage Analytics**: Feature usage, call duration, device information
3. **Error Tracking**: Comprehensive error logging with context
4. **System Health**: Real-time system status monitoring

#### Implementation

```typescript
export class VideoCallMonitoring {
  private metricsBuffer: CallQualityMetrics[] = [];
  private analyticsBuffer: CallUsageAnalytics[] = [];
  private errorBuffer: CallErrorEvent[] = [];

  async trackCallQuality(metrics: CallQualityMetrics): Promise<void>;
  async trackUsageAnalytics(analytics: CallUsageAnalytics): Promise<void>;
  async trackError(error: CallErrorEvent): Promise<void>;
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics>;
}
```

### VideoCallSecurity

Provides authentication, authorization, and security features.

#### Security Features

1. **Authentication**: JWT token validation
2. **Authorization**: Permission-based access control
3. **Rate Limiting**: Prevent abuse and spam
4. **Session Management**: Secure session handling
5. **Data Sanitization**: Input validation and sanitization

#### Implementation

```typescript
export class VideoCallSecurity {
  static checkRateLimit(userId: string, action: string): boolean;
  static validateSignalData(signalType: string, data: any): boolean;
  static validateSecureContext(): { isSecure: boolean; message?: string };

  async verifyCallPermissions(
    userId: string,
    roomId: string,
    receiverId: string
  ): Promise<CallPermissions>;
  async logCallEvent(
    event: string,
    callId: string,
    userId: string,
    metadata?: any
  ): Promise<void>;
}
```

### useVideoCall Hook

React hook that provides state management and actions for video calls.

#### State Management

```typescript
interface UseVideoCallState {
  // Call state
  currentCall: VideoCall | null;
  isInCall: boolean;
  isConnecting: boolean;
  incomingCall: VideoCall | null;
  callStatus: string;
  connectionState: RTCPeerConnectionState | null;

  // Media state
  mediaState: MediaStreamState;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;

  // Performance state
  connectionMetrics: ConnectionMetrics;
  currentVideoQuality: string;
  availableQualities: string[];
  adaptiveQualityEnabled: boolean;

  // Actions
  startCall: (
    roomId: string,
    receiverId: string,
    callType?: CallType
  ) => Promise<void>;
  answerCall: (callId: string, accept: boolean) => Promise<void>;
  endCall: (reason?: string) => Promise<void>;
  toggleCamera: () => boolean;
  toggleMicrophone: () => boolean;
  setVideoQuality: (quality: string) => Promise<void>;
  setAdaptiveQuality: (enabled: boolean) => void;
}
```

## Database Schema

### Core Tables

#### video_calls

```sql
CREATE TABLE video_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    caller_id UUID REFERENCES auth.users(id),
    receiver_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL CHECK (status IN ('calling', 'ringing', 'active', 'ended', 'declined', 'failed')),
    call_type TEXT NOT NULL CHECK (call_type IN ('video', 'audio')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    end_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### webrtc_signals

```sql
CREATE TABLE webrtc_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES video_calls(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    receiver_id UUID REFERENCES auth.users(id),
    signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice_candidate')),
    signal_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Monitoring Tables

#### video_call_quality_metrics

```sql
CREATE TABLE video_call_quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES video_calls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    connection_time INTEGER NOT NULL DEFAULT 0,
    ice_gathering_time INTEGER NOT NULL DEFAULT 0,
    audio_quality JSONB NOT NULL DEFAULT '{}',
    video_quality JSONB NOT NULL DEFAULT '{}',
    network_conditions JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Row Level Security

All tables implement RLS policies:

```sql
-- Users can only access their own data
CREATE POLICY "Users can view their own calls" ON video_calls
    FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Admins can view all data for monitoring
CREATE POLICY "Admins can view all calls" ON video_calls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

## Performance Optimizations

### Connection Pooling

```typescript
private connectionPool: Map<string, RTCPeerConnection> = new Map();

private setupPeerConnection(): RTCPeerConnection {
  const connectionKey = this.currentCall?.id || 'default';
  let existingConnection = this.connectionPool.get(connectionKey);

  if (existingConnection && existingConnection.connectionState === 'closed') {
    this.connectionPool.delete(connectionKey);
    existingConnection = null;
  }

  if (!existingConnection) {
    this.peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);
    if (this.currentCall) {
      this.connectionPool.set(connectionKey, this.peerConnection);
    }
  } else {
    this.peerConnection = existingConnection;
  }

  return this.peerConnection;
}
```

### Signal Batching

```typescript
private batchSignal(signalType: string, signalData: any): void {
  // Priority signals are sent immediately
  if (SIGNAL_BATCH_CONFIG.prioritySignals.includes(signalType as any)) {
    this.sendSignal(signalType as any, signalData);
    return;
  }

  // Add to batch
  this.signalBatch.push({
    type: signalType,
    data: signalData,
    timestamp: Date.now(),
  });

  // Send batch if it's full or after timeout
  if (this.signalBatch.length >= SIGNAL_BATCH_CONFIG.maxBatchSize) {
    this.flushSignalBatch();
  } else if (!this.batchTimer) {
    this.batchTimer = setTimeout(() => {
      this.flushSignalBatch();
    }, SIGNAL_BATCH_CONFIG.batchTimeoutMs);
  }
}
```

### Adaptive Quality

```typescript
private async adjustVideoQuality(): Promise<void> {
  let targetQuality = this.currentVideoQuality;

  // Determine target quality based on metrics
  if (this.connectionMetrics.packetLoss > 0.05 || this.connectionMetrics.bandwidth < 300000) {
    targetQuality = 'low';
  } else if (this.connectionMetrics.packetLoss > 0.02 || this.connectionMetrics.bandwidth < 800000) {
    targetQuality = 'medium';
  } else if (this.connectionMetrics.bandwidth > 1500000) {
    targetQuality = 'high';
  }

  if (targetQuality !== this.currentVideoQuality) {
    await this.setVideoQuality(targetQuality);
  }
}
```

### Lazy Loading

```typescript
// Lazy load video call components
export const LazyVideoCallInterface = lazy(() =>
  import("@/components/video-call/VideoCallInterface").then((module) => ({
    default: module.VideoCallInterface,
  }))
);

// Preload based on user context
export const shouldPreloadVideoCall = (
  userRole?: string,
  hasActiveChat?: boolean
): boolean => {
  return (
    (userRole === "doctor" || userRole === "patient") && hasActiveChat === true
  );
};
```

## Event System

### Event Types

```typescript
export type VideoCallEvent =
  | { type: "call_created"; call: VideoCall }
  | { type: "call_updated"; call: VideoCall }
  | { type: "incoming_call"; call: VideoCall }
  | { type: "signal_received"; signal: WebRTCSignal }
  | { type: "connection_state_changed"; state: RTCPeerConnectionState }
  | { type: "remote_stream_added"; stream: MediaStream }
  | { type: "error"; error: Error };
```

### Event Handling

```typescript
// Service emits events
private emit(event: VideoCallEvent): void {
  this.eventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error("Error in event listener:", error);
    }
  });
}

// Hook listens to events
const handleVideoCallEvent = (event: VideoCallEvent) => {
  switch (event.type) {
    case "call_created":
      setCurrentCall(event.call);
      setIsInCall(true);
      break;
    case "connection_state_changed":
      setConnectionState(event.state);
      break;
    case "error":
      setError(event.error);
      break;
  }
};
```

## Testing Strategy

### Unit Tests

```typescript
// Test VideoCallService methods
describe("VideoCallService", () => {
  let videoCallService: VideoCallService;

  beforeEach(() => {
    videoCallService = new VideoCallService(mockSupabase, "test-user-id");
  });

  it("should create WebRTC offer", async () => {
    await videoCallService.acquireMediaStream();
    const offer = await videoCallService.createOffer();
    expect(offer.type).toBe("offer");
  });

  it("should handle ICE candidates", async () => {
    const candidateData = {
      candidate: "candidate:1 1 UDP 2130706431 192.168.1.1 54400 typ host",
      sdpMLineIndex: 0,
      sdpMid: "0",
    };

    await expect(
      videoCallService.handleIceCandidate(candidateData)
    ).resolves.not.toThrow();
  });
});
```

### Integration Tests

```typescript
// Test complete call flow
describe("Video Call Integration", () => {
  it("should complete full call lifecycle", async () => {
    const caller = new VideoCallService(supabase, "caller-id");
    const receiver = new VideoCallService(supabase, "receiver-id");

    // Start call
    const call = await caller.startCall("room-id", "receiver-id");
    expect(call.status).toBe("calling");

    // Answer call
    await receiver.answerCall(call.id, true);

    // Verify connection
    await waitFor(() => {
      expect(caller.getConnectionState()).toBe("connected");
      expect(receiver.getConnectionState()).toBe("connected");
    });

    // End call
    await caller.endCall();
    expect(call.status).toBe("ended");
  });
});
```

### E2E Tests

```typescript
// Test UI interactions
describe("Video Call E2E", () => {
  it("should start and end video call", async () => {
    await page.goto("/chat/room-123");

    // Start call
    await page.click('[data-testid="start-video-call"]');
    await page.waitForSelector('[data-testid="video-call-interface"]');

    // Verify local video
    const localVideo = await page.$('[data-testid="local-video"]');
    expect(localVideo).toBeTruthy();

    // End call
    await page.click('[data-testid="end-call"]');
    await page.waitForSelector('[data-testid="call-ended"]');
  });
});
```

## Error Handling

### Error Types

```typescript
export enum VideoCallErrorType {
  WEBRTC_NOT_SUPPORTED = "webrtc_not_supported",
  MEDIA_PERMISSION_DENIED = "media_permission_denied",
  CONNECTION_FAILED = "connection_failed",
  SIGNALING_ERROR = "signaling_error",
  AUTHENTICATION_ERROR = "authentication_error",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  UNKNOWN_ERROR = "unknown_error",
}
```

### Error Handler

```typescript
export class VideoCallErrorHandler {
  static createError(type: VideoCallErrorType, originalError?: Error): Error {
    const errorMessages = {
      [VideoCallErrorType.WEBRTC_NOT_SUPPORTED]:
        "WebRTC is not supported in this browser",
      [VideoCallErrorType.MEDIA_PERMISSION_DENIED]:
        "Camera and microphone access denied",
      [VideoCallErrorType.CONNECTION_FAILED]:
        "Failed to establish video call connection",
      // ... more error messages
    };

    const message = errorMessages[type] || "An unknown error occurred";
    const error = new Error(message);
    error.name = type;

    if (originalError) {
      error.cause = originalError;
      error.stack = originalError.stack;
    }

    return error;
  }

  static detectErrorType(error: Error): VideoCallErrorType {
    if (error.message.includes("Permission denied")) {
      return VideoCallErrorType.MEDIA_PERMISSION_DENIED;
    }
    if (error.message.includes("Rate limit")) {
      return VideoCallErrorType.RATE_LIMIT_EXCEEDED;
    }
    // ... more error detection logic

    return VideoCallErrorType.UNKNOWN_ERROR;
  }
}
```

## Development Workflow

### Setup Development Environment

```bash
# Clone repository
git clone <repository-url>
cd video-call-system

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Development Commands

```bash
# Run tests
npm run test
npm run test:watch
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Build
npm run build

# Database operations
npm run db:migrate
npm run db:reset
npm run db:seed
```

### Code Style Guidelines

1. **TypeScript**: Use strict TypeScript configuration
2. **ESLint**: Follow configured ESLint rules
3. **Prettier**: Use Prettier for code formatting
4. **Naming**: Use descriptive names for variables and functions
5. **Comments**: Document complex logic and public APIs
6. **Error Handling**: Always handle errors gracefully
7. **Testing**: Write tests for all new features

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/video-call-enhancement

# Make changes and commit
git add .
git commit -m "feat: add adaptive video quality"

# Push and create PR
git push origin feature/video-call-enhancement
```

### Debugging

#### Browser DevTools

1. **WebRTC Internals**: chrome://webrtc-internals/
2. **Console Logs**: Enable debug logging
3. **Network Tab**: Monitor WebSocket connections
4. **Performance Tab**: Profile performance issues

#### Application Debugging

```typescript
// Enable debug logging
localStorage.setItem("debug", "video-call:*");

// Monitor connection metrics
const metrics = videoCallService.getConnectionMetrics();
console.table(metrics);

// Track performance
const lazyLoadMetrics = getLazyLoadMetrics();
console.table(lazyLoadMetrics);
```

This developer guide provides comprehensive information for developers working on the video call system, covering architecture, implementation details, testing strategies, and development workflows.
