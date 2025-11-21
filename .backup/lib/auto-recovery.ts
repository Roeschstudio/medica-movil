"use client";

import { useEffect, useState } from "react";
import { chatService } from "./chat-service";
import { dbOptimizer } from "./db-optimization";
import { fileCache, messageCache, userCache } from "./enhanced-cache";
import { healthMonitor } from "./health-monitor";
import { performanceMonitor } from "./performance-monitor";

interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  trigger: (health: any) => boolean;
  action: () => Promise<boolean>;
  cooldown: number; // milliseconds
  maxRetries: number;
  priority: number; // higher = more important
}

interface RecoveryAttempt {
  actionId: string;
  timestamp: number;
  success: boolean;
  error?: string;
  retryCount: number;
}

class AutoRecoverySystem {
  private actions: Map<string, RecoveryAction> = new Map();
  private lastAttempts: Map<string, RecoveryAttempt> = new Map();
  private isEnabled = true;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private recoveryHistory: RecoveryAttempt[] = [];

  constructor() {
    this.registerDefaultActions();
    this.startMonitoring();
  }

  // Register default recovery actions
  private registerDefaultActions(): void {
    // Database connection recovery
    this.registerAction({
      id: "db_reconnect",
      name: "Database Reconnection",
      description: "Attempt to reconnect to the database",
      trigger: (health) => {
        const dbCheck = health.checks.find((c: any) => c.name === "database");
        return dbCheck && dbCheck.status === "unhealthy";
      },
      action: async () => {
        try {
          // Clear database cache to force fresh connections
          dbOptimizer.invalidateCache(".*");

          // Test database connection
          const testResult = await dbOptimizer.executeQuery(
            async () => {
              const { data, error } = await dbOptimizer.supabase
                .from("users")
                .select("id")
                .limit(1);
              if (error) throw error;
              return data;
            },
            { cache: false, retries: 1 }
          );

          performanceMonitor.incrementCounter("recovery.db_reconnect.success");
          return true;
        } catch (error) {
          console.error("Database reconnection failed:", error);
          performanceMonitor.incrementCounter("recovery.db_reconnect.failed");
          return false;
        }
      },
      cooldown: 60000, // 1 minute
      maxRetries: 3,
      priority: 10,
    });

    // Chat service recovery
    this.registerAction({
      id: "chat_reconnect",
      name: "Chat Service Reconnection",
      description: "Attempt to reconnect chat service",
      trigger: (health) => {
        const chatCheck = health.checks.find(
          (c: any) => c.name === "chat_service"
        );
        return chatCheck && chatCheck.status === "unhealthy";
      },
      action: async () => {
        try {
          await chatService.reconnect();

          // Wait a moment for connection to stabilize
          await new Promise((resolve) => {
            setTimeout(resolve, 2000);
          });

          const status = chatService.getConnectionStatus();
          if (status.isConnected) {
            performanceMonitor.incrementCounter(
              "recovery.chat_reconnect.success"
            );
            return true;
          } else {
            throw new Error(
              "Chat service still not connected after reconnection attempt"
            );
          }
        } catch (error) {
          console.error("Chat service reconnection failed:", error);
          performanceMonitor.incrementCounter("recovery.chat_reconnect.failed");
          return false;
        }
      },
      cooldown: 30000, // 30 seconds
      maxRetries: 5,
      priority: 9,
    });

    // Cache cleanup recovery
    this.registerAction({
      id: "cache_cleanup",
      name: "Cache Cleanup",
      description: "Clear caches to free memory and reset state",
      trigger: (health) => {
        const cacheCheck = health.checks.find((c: any) => c.name === "cache");
        return cacheCheck && cacheCheck.status === "unhealthy";
      },
      action: async () => {
        try {
          // Clear all caches
          messageCache.clear();
          userCache.clear();
          fileCache.clear();

          // Clear database query cache
          dbOptimizer.invalidateCache(".*");

          performanceMonitor.incrementCounter("recovery.cache_cleanup.success");
          return true;
        } catch (error) {
          console.error("Cache cleanup failed:", error);
          performanceMonitor.incrementCounter("recovery.cache_cleanup.failed");
          return false;
        }
      },
      cooldown: 120000, // 2 minutes
      maxRetries: 2,
      priority: 5,
    });

    // Memory pressure relief
    this.registerAction({
      id: "memory_relief",
      name: "Memory Pressure Relief",
      description: "Attempt to reduce memory usage",
      trigger: (health) => {
        const performanceCheck = health.checks.find(
          (c: any) => c.name === "performance"
        );
        return (
          performanceCheck &&
          performanceCheck.error &&
          performanceCheck.error.includes("memory")
        );
      },
      action: async () => {
        try {
          // Force garbage collection if available
          if (typeof window !== "undefined" && (window as any).gc) {
            (window as any).gc();
          }

          // Clear caches more aggressively
          messageCache.clear();
          userCache.clear();
          fileCache.clear();

          // Clear performance monitor history
          performanceMonitor.clear();

          performanceMonitor.incrementCounter("recovery.memory_relief.success");
          return true;
        } catch (error) {
          console.error("Memory relief failed:", error);
          performanceMonitor.incrementCounter("recovery.memory_relief.failed");
          return false;
        }
      },
      cooldown: 300000, // 5 minutes
      maxRetries: 2,
      priority: 7,
    });

    // Storage service recovery
    this.registerAction({
      id: "storage_reconnect",
      name: "Storage Service Reconnection",
      description: "Attempt to reconnect to storage service",
      trigger: (health) => {
        const storageCheck = health.checks.find(
          (c: any) => c.name === "storage"
        );
        return storageCheck && storageCheck.status === "unhealthy";
      },
      action: async () => {
        try {
          // Test storage connection by listing buckets
          const { data, error } =
            await chatService.supabase.storage.listBuckets();

          if (error) {
            throw error;
          }

          performanceMonitor.incrementCounter(
            "recovery.storage_reconnect.success"
          );
          return true;
        } catch (error) {
          console.error("Storage reconnection failed:", error);
          performanceMonitor.incrementCounter(
            "recovery.storage_reconnect.failed"
          );
          return false;
        }
      },
      cooldown: 60000, // 1 minute
      maxRetries: 3,
      priority: 6,
    });

    // Realtime service recovery
    this.registerAction({
      id: "realtime_reconnect",
      name: "Realtime Service Reconnection",
      description: "Attempt to reconnect to realtime service",
      trigger: (health) => {
        const realtimeCheck = health.checks.find(
          (c: any) => c.name === "realtime"
        );
        return realtimeCheck && realtimeCheck.status === "unhealthy";
      },
      action: async () => {
        try {
          // Reconnect chat service (which handles realtime)
          await chatService.reconnect();

          // Wait for connection to stabilize
          await new Promise((resolve) => {
            setTimeout(resolve, 3000);
          });

          const status = chatService.getConnectionStatus();
          if (status.isConnected) {
            performanceMonitor.incrementCounter(
              "recovery.realtime_reconnect.success"
            );
            return true;
          } else {
            throw new Error("Realtime service still not connected");
          }
        } catch (error) {
          console.error("Realtime reconnection failed:", error);
          performanceMonitor.incrementCounter(
            "recovery.realtime_reconnect.failed"
          );
          return false;
        }
      },
      cooldown: 45000, // 45 seconds
      maxRetries: 4,
      priority: 8,
    });
  }

  // Register a new recovery action
  registerAction(action: RecoveryAction): void {
    this.actions.set(action.id, action);
  }

  // Remove a recovery action
  removeAction(actionId: string): void {
    this.actions.delete(actionId);
    this.lastAttempts.delete(actionId);
  }

  // Start monitoring for recovery triggers
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      if (!this.isEnabled) return;

      try {
        const health = await healthMonitor.getCurrentHealth();
        await this.checkAndExecuteRecovery(health);
      } catch (error) {
        console.error("Recovery monitoring error:", error);
      }
    }, 15000); // Check every 15 seconds
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Check health and execute recovery actions if needed
  private async checkAndExecuteRecovery(health: any): Promise<void> {
    if (health.overall === "healthy") {
      return; // No recovery needed
    }

    // Get applicable actions sorted by priority
    const applicableActions = Array.from(this.actions.values())
      .filter((action) => action.trigger(health))
      .sort((a, b) => b.priority - a.priority);

    for (const action of applicableActions) {
      const lastAttempt = this.lastAttempts.get(action.id);
      const now = Date.now();

      // Check cooldown
      if (lastAttempt && now - lastAttempt.timestamp < action.cooldown) {
        continue;
      }

      // Check max retries
      if (lastAttempt && lastAttempt.retryCount >= action.maxRetries) {
        continue;
      }

      // Execute recovery action
      await this.executeRecoveryAction(action);

      // Only execute one action at a time to avoid conflicts
      break;
    }
  }

  // Execute a specific recovery action
  private async executeRecoveryAction(action: RecoveryAction): Promise<void> {
    const lastAttempt = this.lastAttempts.get(action.id);
    const retryCount = lastAttempt ? lastAttempt.retryCount + 1 : 1;

    console.log(
      `Executing recovery action: ${action.name} (attempt ${retryCount})`
    );

    const startTime = performance.now();
    let success = false;
    let error: string | undefined;

    try {
      success = await action.action();
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error";
      success = false;
    }

    const duration = performance.now() - startTime;

    const attempt: RecoveryAttempt = {
      actionId: action.id,
      timestamp: Date.now(),
      success,
      error,
      retryCount,
    };

    this.lastAttempts.set(action.id, attempt);
    this.recoveryHistory.push(attempt);

    // Keep only last 100 recovery attempts
    if (this.recoveryHistory.length > 100) {
      this.recoveryHistory.splice(0, this.recoveryHistory.length - 100);
    }

    // Record metrics
    performanceMonitor.recordTiming(
      `recovery.${action.id}.duration`,
      startTime
    );
    performanceMonitor.incrementCounter(
      `recovery.${action.id}.${success ? "success" : "failed"}`
    );

    if (success) {
      console.log(
        `Recovery action ${
          action.name
        } completed successfully in ${duration.toFixed(0)}ms`
      );
    } else {
      console.error(
        `Recovery action ${action.name} failed after ${duration.toFixed(0)}ms:`,
        error
      );
    }
  }

  // Manually trigger a recovery action
  async triggerRecovery(actionId: string): Promise<boolean> {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new Error(`Recovery action ${actionId} not found`);
    }

    await this.executeRecoveryAction(action);
    const lastAttempt = this.lastAttempts.get(actionId);
    return lastAttempt ? lastAttempt.success : false;
  }

  // Get recovery statistics
  getRecoveryStats(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    successRate: number;
    recentAttempts: RecoveryAttempt[];
    actionStats: Array<{
      actionId: string;
      name: string;
      attempts: number;
      successes: number;
      failures: number;
      lastAttempt?: RecoveryAttempt;
    }>;
  } {
    const totalAttempts = this.recoveryHistory.length;
    const successfulAttempts = this.recoveryHistory.filter(
      (a) => a.success
    ).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    const successRate =
      totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;

    // Get recent attempts (last 10)
    const recentAttempts = this.recoveryHistory.slice(-10);

    // Get stats per action
    const actionStats = Array.from(this.actions.values()).map((action) => {
      const attempts = this.recoveryHistory.filter(
        (a) => a.actionId === action.id
      );
      const successes = attempts.filter((a) => a.success).length;
      const failures = attempts.length - successes;
      const lastAttempt = this.lastAttempts.get(action.id);

      return {
        actionId: action.id,
        name: action.name,
        attempts: attempts.length,
        successes,
        failures,
        lastAttempt,
      };
    });

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      successRate,
      recentAttempts,
      actionStats,
    };
  }

  // Enable/disable auto recovery
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
    }
  }

  // Check if auto recovery is enabled
  isRecoveryEnabled(): boolean {
    return this.isEnabled;
  }

  // Get all registered actions
  getActions(): RecoveryAction[] {
    return Array.from(this.actions.values());
  }

  // Clear recovery history
  clearHistory(): void {
    this.recoveryHistory = [];
    this.lastAttempts.clear();
  }

  // Destroy auto recovery system
  destroy(): void {
    this.stopMonitoring();
    this.actions.clear();
    this.lastAttempts.clear();
    this.recoveryHistory = [];
  }
}

// Global auto recovery system instance
export const autoRecovery = new AutoRecoverySystem();

// React hook for auto recovery
export function useAutoRecovery() {
  const [stats, setStats] = useState(autoRecovery.getRecoveryStats());
  const [isEnabled, setIsEnabled] = useState(autoRecovery.isRecoveryEnabled());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(autoRecovery.getRecoveryStats());
      setIsEnabled(autoRecovery.isRecoveryEnabled());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const toggleRecovery = (enabled: boolean) => {
    autoRecovery.setEnabled(enabled);
    setIsEnabled(enabled);
  };

  const triggerRecovery = async (actionId: string) => {
    return autoRecovery.triggerRecovery(actionId);
  };

  const clearHistory = () => {
    autoRecovery.clearHistory();
    setStats(autoRecovery.getRecoveryStats());
  };

  return {
    stats,
    isEnabled,
    actions: autoRecovery.getActions(),
    toggleRecovery,
    triggerRecovery,
    clearHistory,
  };
}
