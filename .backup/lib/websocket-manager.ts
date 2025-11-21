import { io, Socket } from "socket.io-client";
import { ErrorLogger } from "./error-handling-utils";

// Connection states
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

// Event types
export interface WebSocketEvents {
  connect: () => void;
  disconnect: (reason: string) => void;
  error: (error: Error) => void;
  reconnect: (attemptNumber: number) => void;
  reconnect_failed: () => void;
  message: (data: any) => void;
  [key: string]: (...args: any[]) => void;
}

// Configuration options
export interface WebSocketConfig {
  url: string;
  path?: string;
  auth?: Record<string, any>;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
  autoConnect?: boolean;
}

// Connection statistics
export interface ConnectionStats {
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  reconnectAttempts: number;
  totalReconnects: number;
  lastError: Error | null;
  uptime: number;
}

/**
 * Enhanced WebSocket Manager with robust error handling and reconnection
 */
export class WebSocketManager {
  private socket: Socket | null = null;
  private config: Required<WebSocketConfig>;
  private state: ConnectionState = "disconnected";
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> =
    new Map();
  private stats: ConnectionStats = {
    connectedAt: null,
    disconnectedAt: null,
    reconnectAttempts: 0,
    totalReconnects: 0,
    lastError: null,
    uptime: 0,
  };
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isManualDisconnect = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      timeout: 10000,
      autoConnect: true,
      path: "/api/socketio",
      ...config,
    };

    if (this.config.autoConnect) {
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.warn("WebSocket already connected");
      return;
    }

    this.setState("connecting");
    this.isManualDisconnect = false;

    try {
      this.socket = io(this.config.url, {
        path: this.config.path,
        auth: this.config.auth,
        timeout: this.config.timeout,
        reconnection: false, // We handle reconnection manually
        forceNew: true,
      });

      this.setupEventHandlers();

      // Wait for connection or timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, this.config.timeout);

        this.socket!.once("connect", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.once("connect_error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.setState("connected");
      this.stats.connectedAt = new Date();
      this.stats.reconnectAttempts = 0;
      this.startHeartbeat();

      console.log("WebSocket connected successfully");
    } catch (error) {
      this.handleConnectionError(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.stopHeartbeat();
    this.clearReconnectTimeout();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.setState("disconnected");
    this.stats.disconnectedAt = new Date();
    console.log("WebSocket disconnected");
  }

  /**
   * Send message to server
   */
  emit(event: string, data?: any): boolean {
    if (!this.socket?.connected) {
      console.warn("Cannot emit: WebSocket not connected");
      return false;
    }

    try {
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      ErrorLogger.log(error as Error, { event, data });
      return false;
    }
  }

  /**
   * Listen for events
   */
  on<K extends keyof WebSocketEvents>(
    event: K,
    listener: WebSocketEvents[K]
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    // Also register with socket if connected
    if (this.socket) {
      this.socket.on(event, listener);
    }
  }

  /**
   * Remove event listener
   */
  off<K extends keyof WebSocketEvents>(
    event: K,
    listener: WebSocketEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }

    if (this.socket) {
      this.socket.off(event, listener);
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    const now = Date.now();
    const uptime = this.stats.connectedAt
      ? now - this.stats.connectedAt.getTime()
      : 0;

    return {
      ...this.stats,
      uptime,
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Force reconnection
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    await this.connect();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connect", () => {
      this.setState("connected");
      this.stats.connectedAt = new Date();
      this.stats.reconnectAttempts = 0;
      this.emit("connect");
    });

    this.socket.on("disconnect", (reason) => {
      this.setState("disconnected");
      this.stats.disconnectedAt = new Date();
      this.stopHeartbeat();

      console.log("WebSocket disconnected:", reason);
      this.emit("disconnect", reason);

      // Auto-reconnect unless manually disconnected
      if (!this.isManualDisconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket.on("connect_error", (error) => {
      this.handleConnectionError(error);
    });

    // Register all custom event listeners
    this.eventListeners.forEach((listeners, event) => {
      listeners.forEach((listener) => {
        this.socket!.on(event, listener);
      });
    });
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    this.setState("error");
    this.stats.lastError = error;

    ErrorLogger.log(error, {
      context: "websocket_connection",
      url: this.config.url,
      reconnectAttempts: this.stats.reconnectAttempts,
    });

    this.emit("error", error);

    if (!this.isManualDisconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.stats.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.emit("reconnect_failed");
      return;
    }

    this.setState("reconnecting");
    this.stats.reconnectAttempts++;

    const delay = Math.min(
      this.config.reconnectDelay *
        Math.pow(2, this.stats.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.stats.reconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        this.stats.totalReconnects++;
        this.emit("reconnect", this.stats.reconnectAttempts);
      } catch (error) {
        console.error("Reconnection failed:", error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Start heartbeat to monitor connection health
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("ping", Date.now());
      } else {
        console.warn("Heartbeat: Socket not connected");
        this.handleConnectionError(
          new Error("Heartbeat failed: Socket not connected")
        );
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Clear reconnection timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Set connection state and notify listeners
   */
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      console.log(`WebSocket state changed: ${oldState} -> ${newState}`);
    }
  }

  /**
   * Emit event to registered listeners
   */
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          ErrorLogger.log(error as Error, { event, args });
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
    this.clearReconnectTimeout();
    this.stopHeartbeat();
  }
}

/**
 * Singleton WebSocket manager for the application
 */
class ApplicationWebSocketManager {
  private static instance: WebSocketManager | null = null;

  static getInstance(config?: WebSocketConfig): WebSocketManager {
    if (!ApplicationWebSocketManager.instance && config) {
      ApplicationWebSocketManager.instance = new WebSocketManager(config);
    }

    if (!ApplicationWebSocketManager.instance) {
      throw new Error(
        "WebSocket manager not initialized. Call getInstance with config first."
      );
    }

    return ApplicationWebSocketManager.instance;
  }

  static destroy(): void {
    if (ApplicationWebSocketManager.instance) {
      ApplicationWebSocketManager.instance.destroy();
      ApplicationWebSocketManager.instance = null;
    }
  }
}

export { ApplicationWebSocketManager as WebSocketManager };

/**
 * React hook for WebSocket connection
 */
export function useWebSocket(config?: WebSocketConfig) {
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>("disconnected");
  const [stats, setStats] = React.useState<ConnectionStats | null>(null);
  const wsManager = React.useRef<WebSocketManager | null>(null);

  React.useEffect(() => {
    if (config) {
      wsManager.current = new WebSocketManager(config);

      // Monitor connection state
      const updateState = () => {
        setConnectionState(wsManager.current!.getState());
        setStats(wsManager.current!.getStats());
      };

      wsManager.current.on("connect", updateState);
      wsManager.current.on("disconnect", updateState);
      wsManager.current.on("reconnect", updateState);
      wsManager.current.on("error", updateState);

      // Initial state
      updateState();

      return () => {
        wsManager.current?.destroy();
      };
    }
  }, [config]);

  const emit = React.useCallback((event: string, data?: any) => {
    return wsManager.current?.emit(event, data) || false;
  }, []);

  const on = React.useCallback(
    (event: string, listener: (...args: unknown[]) => void) => {
      wsManager.current?.on(event as any, listener as any);
    },
    []
  );

  const off = React.useCallback(
    (event: string, listener: (...args: unknown[]) => void) => {
      wsManager.current?.off(event as any, listener as any);
    },
    []
  );

  return {
    connectionState,
    stats,
    isConnected: connectionState === "connected",
    emit,
    on,
    off,
    reconnect: () => wsManager.current?.reconnect(),
  };
}
