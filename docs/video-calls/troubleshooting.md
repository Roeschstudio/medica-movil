# Video Call Troubleshooting Guide

## Common Issues and Solutions

### Connection Issues

#### Problem: "Connection failed - attempting to reconnect"

**Symptoms:**

- Call fails to establish connection
- Connection drops during call
- "Connection failed" error message

**Possible Causes:**

1. Network connectivity issues
2. Firewall blocking WebRTC traffic
3. NAT traversal problems
4. STUN server unavailable

**Solutions:**

1. **Check Network Connection:**

   ```bash
   # Test internet connectivity
   ping google.com

   # Test STUN server connectivity
   ping stun.l.google.com
   ```

2. **Verify HTTPS:**

   - WebRTC requires HTTPS in production
   - Check that your site is served over HTTPS
   - Verify SSL certificate is valid

3. **Firewall Configuration:**

   - Allow UDP traffic on ports 1024-65535
   - Allow TCP traffic on port 443
   - Configure corporate firewall for WebRTC

4. **NAT/Router Issues:**
   - Enable UPnP on router if available
   - Configure port forwarding for WebRTC
   - Use TURN server for symmetric NAT

#### Problem: "ICE gathering timeout"

**Symptoms:**

- Long delay before connection attempt
- Connection never establishes
- ICE gathering state stuck

**Solutions:**

1. **Add More STUN Servers:**

   ```typescript
   const RTC_CONFIGURATION = {
     iceServers: [
       { urls: "stun:stun.l.google.com:19302" },
       { urls: "stun:stun1.l.google.com:19302" },
       { urls: "stun:stun.stunprotocol.org:3478" },
       // Add more STUN servers
     ],
   };
   ```

2. **Configure TURN Server:**

   ```typescript
   const RTC_CONFIGURATION = {
     iceServers: [
       {
         urls: "turn:your-turn-server.com:3478",
         username: "username",
         credential: "password",
       },
     ],
   };
   ```

3. **Increase ICE Candidate Pool:**
   ```typescript
   const RTC_CONFIGURATION = {
     iceCandidatePoolSize: 20, // Increase from default 10
   };
   ```

### Media Issues

#### Problem: "Permission denied" for camera/microphone

**Symptoms:**

- Browser permission dialog denied
- No local video/audio stream
- "Failed to acquire media stream" error

**Solutions:**

1. **Check Browser Permissions:**

   - Click camera/microphone icon in address bar
   - Allow camera and microphone access
   - Refresh page after granting permissions

2. **HTTPS Requirement:**

   - Camera/microphone require HTTPS (except localhost)
   - Verify site is served over HTTPS
   - Check for mixed content warnings

3. **Device Availability:**

   ```typescript
   // Check available devices
   const devices = await navigator.mediaDevices.enumerateDevices();
   const videoDevices = devices.filter((d) => d.kind === "videoinput");
   const audioDevices = devices.filter((d) => d.kind === "audioinput");

   if (videoDevices.length === 0) {
     console.error("No camera devices found");
   }
   if (audioDevices.length === 0) {
     console.error("No microphone devices found");
   }
   ```

4. **Device In Use:**
   - Close other applications using camera/microphone
   - Check if another browser tab is using media
   - Restart browser if device appears stuck

#### Problem: Poor video/audio quality

**Symptoms:**

- Pixelated or blurry video
- Audio cutting out or distorted
- High latency or delay

**Solutions:**

1. **Check Network Bandwidth:**

   ```typescript
   // Monitor connection metrics
   const metrics = videoCallService.getConnectionMetrics();
   console.log("Bandwidth:", metrics.bandwidth);
   console.log("Packet Loss:", metrics.packetLoss);
   console.log("Jitter:", metrics.jitter);
   ```

2. **Adjust Video Quality:**

   ```typescript
   // Set lower quality for poor connections
   await videoCallService.setManualVideoQuality("low");

   // Or enable adaptive quality
   videoCallService.setAdaptiveQuality(true);
   ```

3. **Network Optimization:**

   - Close bandwidth-heavy applications
   - Use wired connection instead of WiFi
   - Move closer to WiFi router
   - Check for network congestion

4. **Device Performance:**
   - Close unnecessary browser tabs
   - Check CPU usage
   - Ensure adequate RAM available
   - Update browser to latest version

### Browser Compatibility Issues

#### Problem: "WebRTC not supported"

**Symptoms:**

- Error message about WebRTC support
- Video call features not available
- Blank video elements

**Solutions:**

1. **Check Browser Version:**

   ```typescript
   const isSupported = VideoCallService.isWebRTCSupported();
   if (!isSupported) {
     // Show upgrade message
     console.log("Browser:", navigator.userAgent);
   }
   ```

2. **Update Browser:**

   - Chrome 60+ required
   - Firefox 60+ required
   - Safari 12+ required
   - Edge 79+ required

3. **Enable WebRTC:**

   - Chrome: chrome://flags/#enable-webrtc
   - Firefox: media.peerconnection.enabled = true
   - Safari: Develop menu > Experimental Features > WebRTC

4. **Use Polyfills:**
   ```typescript
   // Automatic polyfill loading
   await loadWebRTCPolyfills();
   ```

### Authentication and Security Issues

#### Problem: "Authentication required" or "Insufficient permissions"

**Symptoms:**

- Cannot start video calls
- Permission denied errors
- Authentication failures

**Solutions:**

1. **Check User Authentication:**

   ```typescript
   const { user } = useAuth();
   if (!user) {
     // Redirect to login
     router.push("/login");
   }
   ```

2. **Verify User Permissions:**

   ```typescript
   // Check if user can initiate calls
   const permissions = await security.verifyCallPermissions(
     userId,
     roomId,
     receiverId
   );

   if (!permissions.canInitiateCalls) {
     console.error("User cannot initiate calls");
   }
   ```

3. **Session Validation:**

   - Check if JWT token is valid
   - Verify token hasn't expired
   - Refresh authentication if needed

4. **Database Permissions:**
   - Verify Row Level Security policies
   - Check user roles and permissions
   - Ensure proper database access

#### Problem: "Rate limit exceeded"

**Symptoms:**

- Cannot start multiple calls quickly
- "Rate limit exceeded" error
- Temporary call restrictions

**Solutions:**

1. **Wait and Retry:**

   - Rate limits reset after time period
   - Wait before attempting another call
   - Implement exponential backoff

2. **Check Rate Limit Status:**

   ```typescript
   const canCall = VideoCallSecurity.checkRateLimit(userId, "start_call");
   if (!canCall) {
     // Show rate limit message
     console.log("Rate limit active, please wait");
   }
   ```

3. **Adjust Rate Limits:**
   - Modify rate limit configuration if needed
   - Consider user role-based limits
   - Monitor for abuse patterns

### Performance Issues

#### Problem: Slow connection establishment

**Symptoms:**

- Long delay before call connects
- "Connecting..." state persists
- Poor user experience

**Solutions:**

1. **Monitor Connection Metrics:**

   ```typescript
   const metrics = videoCallService.getConnectionMetrics();
   console.log("Connection Time:", metrics.connectionTime);
   console.log("ICE Gathering Time:", metrics.iceGatheringTime);
   ```

2. **Optimize ICE Configuration:**

   ```typescript
   const RTC_CONFIGURATION = {
     iceCandidatePoolSize: 10,
     bundlePolicy: "max-bundle",
     rtcpMuxPolicy: "require",
   };
   ```

3. **Preload Dependencies:**

   ```typescript
   // Preload video call components
   if (shouldPreloadVideoCall(userRole, hasActiveChat)) {
     preloadVideoCallDependencies();
   }
   ```

4. **Use Connection Pooling:**
   - Connections are automatically pooled
   - Reuse existing connections when possible
   - Monitor pool efficiency

#### Problem: High memory usage

**Symptoms:**

- Browser becomes slow during calls
- Memory usage increases over time
- Browser crashes or freezes

**Solutions:**

1. **Proper Cleanup:**

   ```typescript
   // Ensure proper cleanup on call end
   useEffect(() => {
     return () => {
       videoCallService.cleanup();
     };
   }, []);
   ```

2. **Monitor Resource Usage:**

   ```typescript
   // Check for memory leaks
   console.log("Active connections:", connectionPool.size);
   console.log("Event listeners:", eventListeners.length);
   ```

3. **Limit Concurrent Calls:**
   - Restrict to one active call per user
   - Clean up previous calls before starting new ones
   - Monitor system resources

### Database Issues

#### Problem: "Failed to create video call" or database errors

**Symptoms:**

- Database operation failures
- Call records not created
- Signaling data not stored

**Solutions:**

1. **Check Database Connection:**

   ```typescript
   // Test Supabase connection
   const { data, error } = await supabase
     .from("video_calls")
     .select("count")
     .limit(1);

   if (error) {
     console.error("Database connection failed:", error);
   }
   ```

2. **Verify Schema:**

   ```bash
   # Run database migrations
   npm run db:migrate

   # Verify tables exist
   npm run db:verify
   ```

3. **Check RLS Policies:**

   - Verify Row Level Security policies
   - Ensure user has proper access
   - Test policy conditions

4. **Monitor Database Performance:**
   - Check for slow queries
   - Monitor connection pool usage
   - Verify index performance

## Debugging Tools

### Browser Developer Tools

1. **Console Logs:**

   ```typescript
   // Enable debug logging
   localStorage.setItem("debug", "video-call:*");
   ```

2. **WebRTC Internals:**

   - Chrome: chrome://webrtc-internals/
   - Firefox: about:webrtc
   - Monitor connection statistics

3. **Network Tab:**
   - Monitor WebSocket connections
   - Check for failed requests
   - Verify signaling traffic

### Application Debugging

1. **Connection Metrics:**

   ```typescript
   // Get detailed metrics
   const metrics = videoCallService.getConnectionMetrics();
   console.table(metrics);
   ```

2. **Error Tracking:**

   ```typescript
   // Track errors for debugging
   videoCallService.addEventListener((event) => {
     if (event.type === "error") {
       console.error("Video call error:", event.error);
       // Send to error tracking service
     }
   });
   ```

3. **Performance Monitoring:**
   ```typescript
   // Monitor lazy loading performance
   const metrics = getLazyLoadMetrics();
   console.table(metrics);
   ```

## Getting Help

### Support Channels

1. **Documentation:** Check the [README](./README.md) for API reference
2. **Issues:** Report bugs on GitHub Issues
3. **Discussions:** Ask questions in GitHub Discussions
4. **Support:** Contact support team for urgent issues

### Information to Include

When reporting issues, please include:

1. **Browser Information:**

   - Browser name and version
   - Operating system
   - Device type (desktop/mobile)

2. **Error Details:**

   - Complete error message
   - Stack trace if available
   - Steps to reproduce

3. **Network Information:**

   - Connection type (WiFi/cellular/wired)
   - Approximate bandwidth
   - Any corporate firewall/proxy

4. **System Information:**
   - Available memory
   - CPU usage during issue
   - Other running applications

### Diagnostic Commands

```typescript
// Run diagnostic check
const diagnostics = {
  webrtcSupported: VideoCallService.isWebRTCSupported(),
  httpsEnabled: location.protocol === "https:",
  userAgent: navigator.userAgent,
  connectionMetrics: videoCallService.getConnectionMetrics(),
  systemHealth: await monitoring.getSystemHealthMetrics(),
};

console.log("Diagnostics:", diagnostics);
```

This information will help identify and resolve issues more quickly.
