"use client";

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface SystemHealth {
  cpu: number;
  memory: number;
  connections: number;
  errors: number;
  latency: number;
  timestamp: number;
}

interface AlertRule {
  id: string;
  metric: string;
  threshold: number;
  operator: ">" | "<" | "==" | ">=" | "<=";
  duration: number; // milliseconds
  callback: (metric: PerformanceMetric) => void;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Map<string, AlertRule> = new Map();
  private alertStates: Map<string, { triggered: boolean; since: number }> =
    new Map();
  private maxMetricsPerType = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
    this.startSystemMonitoring();
  }

  // Record a performance metric
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Keep only the most recent metrics
    if (metricArray.length > this.maxMetricsPerType) {
      metricArray.splice(0, metricArray.length - this.maxMetricsPerType);
    }

    // Check alerts
    this.checkAlerts(metric);
  }

  // Record timing metric
  recordTiming(
    name: string,
    startTime: number,
    tags?: Record<string, string>
  ): void {
    const duration = performance.now() - startTime;
    this.recordMetric(name, duration, tags);
  }

  // Start timing
  startTiming(): number {
    return performance.now();
  }

  // Record counter increment
  incrementCounter(name: string, tags?: Record<string, string>): void {
    const current = this.getLatestMetric(name)?.value || 0;
    this.recordMetric(name, current + 1, tags);
  }

  // Record gauge value
  recordGauge(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    this.recordMetric(name, value, tags);
  }

  // Get metrics for a specific name
  getMetrics(name: string, limit?: number): PerformanceMetric[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  // Get latest metric value
  getLatestMetric(name: string): PerformanceMetric | undefined {
    const metrics = this.metrics.get(name);
    return metrics && metrics.length > 0
      ? metrics[metrics.length - 1]
      : undefined;
  }

  // Get average value over time period
  getAverage(name: string, timeWindowMs: number): number {
    const now = Date.now();
    const metrics = this.getMetrics(name).filter(
      (m) => now - m.timestamp <= timeWindowMs
    );

    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  // Get percentile value
  getPercentile(
    name: string,
    percentile: number,
    timeWindowMs?: number
  ): number {
    let metrics = this.getMetrics(name);

    if (timeWindowMs) {
      const now = Date.now();
      metrics = metrics.filter((m) => now - m.timestamp <= timeWindowMs);
    }

    if (metrics.length === 0) return 0;

    const values = metrics.map((m) => m.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  // Add alert rule
  addAlert(rule: AlertRule): void {
    this.alerts.set(rule.id, rule);
    this.alertStates.set(rule.id, { triggered: false, since: 0 });
  }

  // Remove alert rule
  removeAlert(id: string): void {
    this.alerts.delete(id);
    this.alertStates.delete(id);
  }

  // Check alerts for a metric
  private checkAlerts(metric: PerformanceMetric): void {
    for (const [alertId, rule] of this.alerts) {
      if (rule.metric !== metric.name) continue;

      const alertState = this.alertStates.get(alertId)!;
      const shouldTrigger = this.evaluateCondition(
        metric.value,
        rule.threshold,
        rule.operator
      );

      if (shouldTrigger && !alertState.triggered) {
        alertState.triggered = true;
        alertState.since = metric.timestamp;
      } else if (!shouldTrigger && alertState.triggered) {
        alertState.triggered = false;
        alertState.since = 0;
      }

      // Check if alert should fire
      if (
        alertState.triggered &&
        metric.timestamp - alertState.since >= rule.duration
      ) {
        rule.callback(metric);
      }
    }
  }

  // Evaluate alert condition
  private evaluateCondition(
    value: number,
    threshold: number,
    operator: string
  ): boolean {
    switch (operator) {
      case ">":
        return value > threshold;
      case "<":
        return value < threshold;
      case ">=":
        return value >= threshold;
      case "<=":
        return value <= threshold;
      case "==":
        return value === threshold;
      default:
        return false;
    }
  }

  // Get system health snapshot
  getSystemHealth(): SystemHealth {
    const now = Date.now();
    return {
      cpu: this.getLatestMetric("system.cpu")?.value || 0,
      memory: this.getLatestMetric("system.memory")?.value || 0,
      connections: this.getLatestMetric("chat.connections")?.value || 0,
      errors: this.getLatestMetric("chat.errors")?.value || 0,
      latency: this.getAverage("chat.message_latency", 60000), // 1 minute average
      timestamp: now,
    };
  }

  // Start system monitoring
  private startSystemMonitoring(): void {
    // Monitor memory usage
    if (typeof window !== "undefined" && "memory" in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        if (memory) {
          this.recordGauge(
            "system.memory",
            (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
          );
        }
      }, 5000);
    }

    // Monitor connection count
    setInterval(() => {
      // This would be updated by the connection pool
      const connections =
        this.getLatestMetric("chat.active_connections")?.value || 0;
      this.recordGauge("system.connections", connections);
    }, 1000);
  }

  // Start cleanup process
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [name, metrics] of this.metrics) {
        const filtered = metrics.filter((m) => now - m.timestamp <= maxAge);
        this.metrics.set(name, filtered);
      }
    }, 60000); // Cleanup every minute
  }

  // Export metrics for external monitoring
  exportMetrics(): Record<string, PerformanceMetric[]> {
    const exported: Record<string, PerformanceMetric[]> = {};
    for (const [name, metrics] of this.metrics) {
      exported[name] = [...metrics];
    }
    return exported;
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
  }

  // Destroy monitor
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    this.alerts.clear();
    this.alertStates.clear();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const recordMetric = (
    name: string,
    value: number,
    tags?: Record<string, string>
  ) => {
    performanceMonitor.recordMetric(name, value, tags);
  };

  const recordTiming = (
    name: string,
    startTime: number,
    tags?: Record<string, string>
  ) => {
    performanceMonitor.recordTiming(name, startTime, tags);
  };

  const startTiming = () => performanceMonitor.startTiming();

  const incrementCounter = (name: string, tags?: Record<string, string>) => {
    performanceMonitor.incrementCounter(name, tags);
  };

  const recordGauge = (
    name: string,
    value: number,
    tags?: Record<string, string>
  ) => {
    performanceMonitor.recordGauge(name, value, tags);
  };

  return {
    recordMetric,
    recordTiming,
    startTiming,
    incrementCounter,
    recordGauge,
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    getLatestMetric:
      performanceMonitor.getLatestMetric.bind(performanceMonitor),
    getAverage: performanceMonitor.getAverage.bind(performanceMonitor),
    getPercentile: performanceMonitor.getPercentile.bind(performanceMonitor),
    getSystemHealth:
      performanceMonitor.getSystemHealth.bind(performanceMonitor),
  };
}

// Decorator for automatic timing
export function timed(metricName: string, tags?: Record<string, string>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = performanceMonitor.startTiming();
      try {
        const result = await originalMethod.apply(this, args);
        performanceMonitor.recordTiming(metricName, startTime, {
          ...tags,
          status: "success",
        });
        return result;
      } catch (error) {
        performanceMonitor.recordTiming(metricName, startTime, {
          ...tags,
          status: "error",
        });
        throw error;
      }
    };

    return descriptor;
  };
}

// Performance measurement utilities
export const perf = {
  // Measure function execution time
  measure: async <T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> => {
    const startTime = performanceMonitor.startTiming();
    try {
      const result = await fn();
      performanceMonitor.recordTiming(name, startTime, {
        ...tags,
        status: "success",
      });
      return result;
    } catch (error) {
      performanceMonitor.recordTiming(name, startTime, {
        ...tags,
        status: "error",
      });
      throw error;
    }
  },

  // Measure sync function execution time
  measureSync: <T>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): T => {
    const startTime = performanceMonitor.startTiming();
    try {
      const result = fn();
      performanceMonitor.recordTiming(name, startTime, {
        ...tags,
        status: "success",
      });
      return result;
    } catch (error) {
      performanceMonitor.recordTiming(name, startTime, {
        ...tags,
        status: "error",
      });
      throw error;
    }
  },

  // Create a timer
  timer: (name: string, tags?: Record<string, string>) => {
    const startTime = performanceMonitor.startTiming();
    return {
      stop: (additionalTags?: Record<string, string>) => {
        performanceMonitor.recordTiming(name, startTime, {
          ...tags,
          ...additionalTags,
        });
      },
    };
  },
};
