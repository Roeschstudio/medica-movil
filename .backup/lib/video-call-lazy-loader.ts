/**
 * Lazy loading utilities for video call components and dependencies
 * Optimizes initial bundle size by loading video call features on demand
 */

import { lazy } from "react";

// Lazy load video call components
export const LazyVideoCallInterface = lazy(() =>
  import("@/components/video-call/VideoCallInterface").then((module) => ({
    default: module.VideoCallInterface,
  }))
);

export const LazyVideoCallPage = lazy(() =>
  import("@/app/video-call/page").then((module) => ({
    default: module.default,
  }))
);

// Lazy load video call service
let videoCallServicePromise: Promise<
  typeof import("./video-call-service")
> | null = null;

export const loadVideoCallService = async () => {
  if (!videoCallServicePromise) {
    videoCallServicePromise = import("./video-call-service");
  }
  return videoCallServicePromise;
};

// Lazy load video call hook
let videoCallHookPromise: Promise<
  typeof import("@/hooks/useVideoCall")
> | null = null;

export const loadVideoCallHook = async () => {
  if (!videoCallHookPromise) {
    videoCallHookPromise = import("@/hooks/useVideoCall");
  }
  return videoCallHookPromise;
};

// Lazy load WebRTC polyfills for older browsers
let webrtcPolyfillPromise: Promise<void> | null = null;

export const loadWebRTCPolyfills = async () => {
  if (!webrtcPolyfillPromise) {
    webrtcPolyfillPromise = (async () => {
      // Check if WebRTC is supported
      if (!window.RTCPeerConnection) {
        // Load adapter.js polyfill
        await import("webrtc-adapter");
      }
    })();
  }
  return webrtcPolyfillPromise;
};

// Preload video call dependencies when user shows intent
export const preloadVideoCallDependencies = async () => {
  try {
    // Preload in parallel for better performance
    await Promise.all([
      loadVideoCallService(),
      loadVideoCallHook(),
      loadWebRTCPolyfills(),
    ]);

    console.log("Video call dependencies preloaded successfully");
  } catch (error) {
    console.warn("Failed to preload video call dependencies:", error);
  }
};

// Check if video call features should be preloaded based on user context
export const shouldPreloadVideoCall = (
  userRole?: string,
  hasActiveChat?: boolean
): boolean => {
  // Preload for doctors and patients in active chat sessions
  return (
    (userRole === "doctor" || userRole === "patient") && hasActiveChat === true
  );
};

// Resource hints for better loading performance
export const addVideoCallResourceHints = () => {
  if (typeof document === "undefined") return;

  // Add DNS prefetch for STUN servers
  const stunServers = [
    "stun.l.google.com",
    "stun1.l.google.com",
    "stun2.l.google.com",
    "stun3.l.google.com",
    "stun4.l.google.com",
    "stun.stunprotocol.org",
    "stun.voiparound.com",
    "stun.voipbuster.com",
  ];

  stunServers.forEach((server) => {
    const link = document.createElement("link");
    link.rel = "dns-prefetch";
    link.href = `//${server}`;
    document.head.appendChild(link);
  });

  // Add preconnect for critical resources
  const preconnectUrls = [
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ];

  preconnectUrls.forEach((url) => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = url;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });
};

// Intersection Observer for lazy loading video call UI
export const createVideoCallObserver = (
  callback: () => void,
  options: IntersectionObserverInit = { threshold: 0.1 }
) => {
  if (typeof window === "undefined" || !window.IntersectionObserver) {
    // Fallback for environments without IntersectionObserver
    setTimeout(callback, 100);
    return null;
  }

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback();
      }
    });
  }, options);
};

// Performance monitoring for lazy loading
interface LazyLoadMetrics {
  componentName: string;
  loadTime: number;
  success: boolean;
  error?: string;
}

const lazyLoadMetrics: LazyLoadMetrics[] = [];

export const trackLazyLoadPerformance = (
  componentName: string,
  loadPromise: Promise<any>
): Promise<any> => {
  const startTime = performance.now();

  return loadPromise
    .then((result) => {
      const loadTime = performance.now() - startTime;
      lazyLoadMetrics.push({
        componentName,
        loadTime,
        success: true,
      });

      console.log(`Lazy loaded ${componentName} in ${loadTime.toFixed(2)}ms`);
      return result;
    })
    .catch((error) => {
      const loadTime = performance.now() - startTime;
      lazyLoadMetrics.push({
        componentName,
        loadTime,
        success: false,
        error: error.message,
      });

      console.error(`Failed to lazy load ${componentName}:`, error);
      throw error;
    });
};

// Get lazy loading performance metrics
export const getLazyLoadMetrics = (): LazyLoadMetrics[] => {
  return [...lazyLoadMetrics];
};

// Clear lazy loading metrics
export const clearLazyLoadMetrics = (): void => {
  lazyLoadMetrics.length = 0;
};

// Bundle size optimization utilities
export const getVideoCallBundleInfo = () => {
  return {
    coreSize: "~45KB", // Estimated core video call service size
    uiSize: "~25KB", // Estimated UI components size
    totalSize: "~70KB", // Total estimated size
    dependencies: ["webrtc-adapter (~15KB)", "react-lazy (~2KB)"],
  };
};
