/**
 * Debug Configuration for Development Environment
 * This file contains configuration for various debugging and analysis tools
 */

module.exports = {
  // Bundle Analyzer Configuration
  bundleAnalyzer: {
    enabled: process.env.ANALYZE === "true",
    openAnalyzer: true,
    analyzerMode: "server",
    analyzerPort: 8888,
  },

  // Dependency Analysis Configuration
  dependencyAnalysis: {
    // Paths to analyze
    includePaths: ["app", "components", "lib", "hooks"],
    // Paths to exclude
    excludePaths: ["node_modules", ".next", "dist", "build"],
    // Output formats
    outputFormats: ["console", "json", "html"],
    // Circular dependency detection
    detectCircular: true,
    // Orphan module detection
    detectOrphans: true,
  },

  // Duplicate Code Detection Configuration
  duplicateDetection: {
    // Minimum lines to consider as duplicate
    minLines: 5,
    // Minimum tokens to consider as duplicate
    minTokens: 50,
    // File formats to analyze
    formats: ["typescript", "javascript", "jsx", "tsx"],
    // Output directory
    outputDir: "./reports/jscpd",
    // Reporters
    reporters: ["html", "console", "badge"],
  },

  // Performance Monitoring Configuration
  performance: {
    // Enable performance monitoring
    enabled: process.env.NODE_ENV === "development",
    // Metrics to collect
    metrics: ["bundle-size", "build-time", "dependency-count"],
    // Thresholds for warnings
    thresholds: {
      bundleSize: "5MB",
      buildTime: "60s",
      dependencyCount: 1000,
    },
  },

  // Error Tracking Configuration
  errorTracking: {
    // Enable error boundary reporting
    enableErrorBoundary: true,
    // Log levels
    logLevel: process.env.NODE_ENV === "development" ? "debug" : "error",
    // Error reporting endpoints
    reportingEndpoints: {
      development: null, // No external reporting in development
      production: process.env.ERROR_REPORTING_URL,
    },
  },
};
