import { toast } from "@/hooks/use-toast";

export interface QueuedMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  messageType: "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "AUDIO";
  fileData?: {
    url: string;
    name: string;
    size: number;
    type: string;
  };
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: "pending" | "sending" | "failed" | "sent";
  error?: string;
}

export interface MessageQueueOptions {
  maxRetries: number;
  retryDelay: number;
  maxQueueSize: number;
  persistToStorage: boolean;
  storageKey: string;
}

const DEFAULT_OPTIONS: MessageQueueOptions = {
  maxRetries: 3,
  retryDelay: 2000,
  maxQueueSize: 100,
  persistToStorage: true,
  storageKey: "chat_message_queue",
};

export class ChatMessageQueue {
  private queue: Map<string, QueuedMessage> = new Map();
  private options: MessageQueueOptions;
  private isProcessing = false;
  private processingTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(queue: QueuedMessage[]) => void> = new Set();

  constructor(options: Partial<MessageQueueOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.loadFromStorage();
  }

  /**
   * Add a message to the queue
   */
  enqueue(
    message: Omit<QueuedMessage, "id" | "timestamp" | "retryCount" | "status">
  ): string {
    // Check queue size limit
    if (this.queue.size >= this.options.maxQueueSize) {
      // Remove oldest message
      const oldestId = Array.from(this.queue.keys())[0];
      this.queue.delete(oldestId);

      toast({
        title: "Cola de mensajes llena",
        description: "Se eliminó el mensaje más antiguo para hacer espacio.",
        variant: "destructive",
      });
    }

    const queuedMessage: QueuedMessage = {
      ...message,
      id: `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    this.queue.set(queuedMessage.id, queuedMessage);
    this.saveToStorage();
    this.notifyListeners();

    return queuedMessage.id;
  }

  /**
   * Remove a message from the queue
   */
  dequeue(messageId: string): boolean {
    const removed = this.queue.delete(messageId);
    if (removed) {
      this.saveToStorage();
      this.notifyListeners();
    }
    return removed;
  }

  /**
   * Get all queued messages
   */
  getQueue(): QueuedMessage[] {
    return Array.from(this.queue.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  /**
   * Get queued messages for a specific chat room
   */
  getQueueForRoom(chatRoomId: string): QueuedMessage[] {
    return this.getQueue().filter((msg) => msg.chatRoomId === chatRoomId);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get queue size for a specific room
   */
  getQueueSizeForRoom(chatRoomId: string): number {
    return this.getQueueForRoom(chatRoomId).length;
  }

  /**
   * Clear all messages from queue
   */
  clear(): void {
    this.queue.clear();
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Clear messages for a specific room
   */
  clearRoom(chatRoomId: string): void {
    const messagesToRemove = Array.from(this.queue.values())
      .filter((msg) => msg.chatRoomId === chatRoomId)
      .map((msg) => msg.id);

    messagesToRemove.forEach((id) => this.queue.delete(id));
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Process the queue - attempt to send all pending messages
   */
  async processQueue(
    sendFunction: (message: QueuedMessage) => Promise<boolean>
  ): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const pendingMessages = this.getQueue().filter(
        (msg) => msg.status === "pending" || msg.status === "failed"
      );

      for (const message of pendingMessages) {
        await this.processMessage(message, sendFunction);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    message: QueuedMessage,
    sendFunction: (message: QueuedMessage) => Promise<boolean>
  ): Promise<void> {
    // Update status to sending
    message.status = "sending";
    message.retryCount++;
    this.queue.set(message.id, message);
    this.notifyListeners();

    try {
      const success = await sendFunction(message);

      if (success) {
        // Message sent successfully - remove from queue
        message.status = "sent";
        this.dequeue(message.id);

        toast({
          title: "Mensaje enviado",
          description: "El mensaje en cola se envió correctamente.",
          variant: "default",
        });
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error(`Failed to send queued message ${message.id}:`, error);

      if (message.retryCount >= message.maxRetries) {
        // Max retries reached - mark as failed
        message.status = "failed";
        message.error =
          error instanceof Error ? error.message : "Unknown error";
        this.queue.set(message.id, message);

        toast({
          title: "Error al enviar mensaje",
          description:
            "No se pudo enviar el mensaje después de varios intentos.",
          variant: "destructive",
        });
      } else {
        // Mark as failed for retry
        message.status = "failed";
        message.error =
          error instanceof Error ? error.message : "Unknown error";
        this.queue.set(message.id, message);

        // Schedule retry with exponential backoff
        const delay =
          this.options.retryDelay * Math.pow(2, message.retryCount - 1);
        setTimeout(() => {
          if (this.queue.has(message.id)) {
            message.status = "pending";
            message.error = undefined;
            this.queue.set(message.id, message);
            this.notifyListeners();
          }
        }, delay);
      }

      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Retry failed messages
   */
  retryFailedMessages(): void {
    const failedMessages = this.getQueue().filter(
      (msg) => msg.status === "failed"
    );

    failedMessages.forEach((message) => {
      if (message.retryCount < message.maxRetries) {
        message.status = "pending";
        message.error = undefined;
        this.queue.set(message.id, message);
      }
    });

    this.saveToStorage();
    this.notifyListeners();

    if (failedMessages.length > 0) {
      toast({
        title: "Reintentando mensajes",
        description: `Reintentando ${failedMessages.length} mensajes fallidos.`,
        variant: "default",
      });
    }
  }

  /**
   * Start automatic processing when online
   */
  startAutoProcessing(
    sendFunction: (message: QueuedMessage) => Promise<boolean>,
    interval: number = 5000
  ): void {
    this.stopAutoProcessing();

    this.processingTimer = setInterval(() => {
      if (navigator.onLine && this.queue.size > 0) {
        this.processQueue(sendFunction).catch((error) => {
          console.error("Auto-processing failed:", error);
        });
      }
    }, interval);
  }

  /**
   * Stop automatic processing
   */
  stopAutoProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  /**
   * Add listener for queue changes
   */
  addListener(listener: (queue: QueuedMessage[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    const queue = this.getQueue();
    this.listeners.forEach((listener) => {
      try {
        listener(queue);
      } catch (error) {
        console.error("Error in queue listener:", error);
      }
    });
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    if (!this.options.persistToStorage || typeof window === "undefined") return;

    try {
      const queueData = Array.from(this.queue.entries());
      localStorage.setItem(this.options.storageKey, JSON.stringify(queueData));
    } catch (error) {
      console.error("Failed to save message queue to storage:", error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    if (!this.options.persistToStorage || typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (stored) {
        const queueData: [string, QueuedMessage][] = JSON.parse(stored);
        this.queue = new Map(queueData);

        // Clean up old messages (older than 24 hours)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const toRemove: string[] = [];

        this.queue.forEach((message, id) => {
          if (message.timestamp < oneDayAgo) {
            toRemove.push(id);
          }
        });

        toRemove.forEach((id) => this.queue.delete(id));

        if (toRemove.length > 0) {
          this.saveToStorage();
        }
      }
    } catch (error) {
      console.error("Failed to load message queue from storage:", error);
      this.queue.clear();
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    sending: number;
    failed: number;
    byRoom: Record<string, number>;
  } {
    const messages = this.getQueue();
    const stats = {
      total: messages.length,
      pending: 0,
      sending: 0,
      failed: 0,
      byRoom: {} as Record<string, number>,
    };

    messages.forEach((message) => {
      switch (message.status) {
        case "pending":
          stats.pending++;
          break;
        case "sending":
          stats.sending++;
          break;
        case "failed":
          stats.failed++;
          break;
      }

      stats.byRoom[message.chatRoomId] =
        (stats.byRoom[message.chatRoomId] || 0) + 1;
    });

    return stats;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoProcessing();
    this.listeners.clear();
    this.queue.clear();
  }
}

// Export singleton instance
let _messageQueue: ChatMessageQueue | null = null;

export const chatMessageQueue = (() => {
  if (!_messageQueue) {
    _messageQueue = new ChatMessageQueue();
  }
  return _messageQueue;
})();

// Export factory function for testing
export const createChatMessageQueue = (
  options?: Partial<MessageQueueOptions>
) => {
  return new ChatMessageQueue(options);
};
