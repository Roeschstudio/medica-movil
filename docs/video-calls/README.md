# Video Call System Documentation

## Overview

The video call system provides secure, real-time video communication between doctors and patients using WebRTC technology. The system is built with performance optimization, security, and reliability in mind.

## Features

- **Real-time Video Calls**: High-quality video and audio communication
- **Adaptive Quality**: Automatic quality adjustment based on network conditions
- **Security**: End-to-end encryption with authentication and authorization
- **Performance Monitoring**: Comprehensive analytics and error tracking
- **Cross-platform**: Works on desktop and mobile browsers
- **Responsive Design**: Optimized for all screen sizes

## Architecture

### Core Components

1. **VideoCallService**: Main service class handling WebRTC connections
2. **VideoCallMonitoring**: Performance and analytics tracking
3. **VideoCallSecurity**: Authentication and security measures
4. **useVideoCall Hook**: React hook for state management
5. **VideoCallInterface**: UI components for video calls

### Database Schema

- `video_calls`: Call records and metadata
- `webrtc_signals`: WebRTC signaling data
- `video_call_quality_metrics`: Performance metrics
- `video_call_usage_analytics`: Usage statistics
- `video_call_error_events`: Error tracking

## Quick Start

### Prerequisites

- Node.js 18+
- Modern browser with WebRTC support
- HTTPS connection (required for WebRTC)
- Supabase project with video call schema

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Run database migrations:

```bash
npm run db:migrate
```

4. Start development server:

```bash
npm run dev
```

### Basic Usage

```typescript
import { useVideoCall } from "@/hooks/useVideoCall";

function VideoCallComponent() {
  const {
    startCall,
    endCall,
    toggleCamera,
    toggleMicrophone,
    currentCall,
    isInCall,
    localVideoRef,
    remoteVideoRef,
  } = useVideoCall();

  const handleStartCall = async () => {
    await startCall("room-id", "receiver-id", "video");
  };

  return (
    <div>
      {isInCall ? (
        <div>
          <video ref={localVideoRef} autoPlay muted />
          <video ref={remoteVideoRef} autoPlay />
          <button onClick={() => endCall()}>End Call</button>
          <button onClick={toggleCamera}>Toggle Camera</button>
          <button onClick={toggleMicrophone}>Toggle Microphone</button>
        </div>
      ) : (
        <button onClick={handleStartCall}>Start Call</button>
      )}
    </div>
  );
}
```

## API Reference

### VideoCallService

The main service class for managing video calls.

#### Constructor

```typescript
new VideoCallService(supabaseClient: any, userId: string)
```

#### Methods

##### `startCall(roomId: string, receiverId: string, callType?: CallType): Promise<VideoCall>`

Initiates a new video call.

**Parameters:**

- `roomId`: Unique identifier for the call room
- `receiverId`: ID of the user to call
- `callType`: 'video' or 'audio' (default: 'video')

**Returns:** Promise resolving to VideoCall object

**Example:**

```typescript
const call = await videoCallService.startCall("room-123", "user-456", "video");
```

##### `answerCall(callId: string, accept: boolean): Promise<void>`

Answers an incoming call.

**Parameters:**

- `callId`: ID of the incoming call
- `accept`: Whether to accept or decline the call

**Example:**

```typescript
await videoCallService.answerCall("call-123", true);
```

##### `endCall(reason?: string): Promise<void>`

Ends the current call.

**Parameters:**

- `reason`: Optional reason for ending the call (default: 'user_ended')

**Example:**

```typescript
await videoCallService.endCall("user_ended");
```

##### `toggleCamera(): boolean`

Toggles the camera on/off.

**Returns:** Current camera state (true = enabled)

##### `toggleMicrophone(): boolean`

Toggles the microphone on/off.

**Returns:** Current microphone state (true = enabled)

##### Performance Methods

```typescript
// Get connection metrics
getConnectionMetrics(): ConnectionMetrics

// Set video quality manually
setManualVideoQuality(quality: string): Promise<void>

// Enable/disable adaptive quality
setAdaptiveQuality(enabled: boolean): void

// Get available quality levels
getAvailableVideoQualities(): string[]
```

### useVideoCall Hook

React hook for video call state management.

#### Return Value

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
  clearError: () => void;
  dismissIncomingCall: () => void;
}
```

## Configuration

### Video Quality Levels

The system supports multiple video quality levels:

```typescript
const VIDEO_QUALITY_LEVELS = {
  low: { width: 320, height: 240, frameRate: 15, bitrate: 150000 },
  medium: { width: 640, height: 480, frameRate: 24, bitrate: 500000 },
  high: { width: 1280, height: 720, frameRate: 30, bitrate: 1200000 },
  ultra: { width: 1920, height: 1080, frameRate: 30, bitrate: 2500000 },
};
```

### WebRTC Configuration

```typescript
const RTC_CONFIGURATION = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // ... more STUN servers
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};
```

### Performance Settings

```typescript
const SIGNAL_BATCH_CONFIG = {
  maxBatchSize: 10,
  batchTimeoutMs: 100,
  prioritySignals: ["offer", "answer"],
};
```

## Security

### Authentication

All video call operations require user authentication:

```typescript
// User must be authenticated
const { user } = useAuth();
if (!user) {
  throw new Error("Authentication required");
}
```

### Authorization

Users can only initiate calls with authorized participants:

```typescript
// Verify call permissions
const permissions = await security.verifyCallPermissions(
  userId,
  roomId,
  receiverId
);
```

### HTTPS Requirement

WebRTC requires a secure context (HTTPS):

```typescript
// Validate secure context
const secureContext = VideoCallSecurity.validateSecureContext();
if (!secureContext.isSecure) {
  throw new Error("HTTPS required for video calls");
}
```

### Rate Limiting

Built-in rate limiting prevents abuse:

```typescript
// Check rate limits
if (!VideoCallSecurity.checkRateLimit(userId, "start_call")) {
  throw new Error("Rate limit exceeded");
}
```

## Monitoring and Analytics

### Call Quality Metrics

The system automatically tracks:

- Connection establishment time
- ICE gathering time
- Audio/video bitrate
- Packet loss percentage
- Jitter measurements
- Network bandwidth

### Usage Analytics

Tracked user behavior includes:

- Call duration
- Feature usage (camera/mic toggles)
- Device information
- Call end reasons
- Quality adjustments

### Error Tracking

Comprehensive error tracking with:

- Error type classification
- Stack traces
- User context
- Recovery suggestions

### System Health

Monitor system health with:

```typescript
// Get system health metrics
const health = await monitoring.getSystemHealthMetrics();
console.log({
  activeCalls: health.activeCalls,
  successRate: health.successRate,
  averageConnectionTime: health.performanceMetrics.averageConnectionTime,
});
```

## Performance Optimization

### Lazy Loading

Components are lazy-loaded to improve initial page load:

```typescript
import { LazyVideoCallInterface } from "@/lib/video-call-lazy-loader";

// Preload when user shows intent
if (shouldPreloadVideoCall(userRole, hasActiveChat)) {
  preloadVideoCallDependencies();
}
```

### Adaptive Quality

Automatic quality adjustment based on network conditions:

```typescript
// Enable adaptive quality (default)
videoCallService.setAdaptiveQuality(true);

// Or set manual quality
await videoCallService.setManualVideoQuality("high");
```

### Connection Pooling

Connections are pooled and reused for better performance:

```typescript
// Connections are automatically pooled by call ID
// No manual intervention required
```

### Signal Batching

ICE candidates are batched to reduce signaling overhead:

```typescript
// Automatic batching - no configuration needed
// Priority signals (offer/answer) are sent immediately
```

## Browser Compatibility

### Supported Browsers

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

### WebRTC Support Detection

```typescript
const isSupported = VideoCallService.isWebRTCSupported();
if (!isSupported) {
  // Show fallback UI or error message
}
```

### Polyfills

Automatic polyfill loading for older browsers:

```typescript
// Automatically loads webrtc-adapter when needed
await loadWebRTCPolyfills();
```

## Deployment

See [Deployment Guide](./deployment.md) for production deployment instructions.

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common issues and solutions.

## Contributing

See [Contributing Guide](./contributing.md) for development guidelines.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
