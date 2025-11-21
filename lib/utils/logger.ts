/**
 * Logger utility for the medical platform
 * Provides structured logging with environment-aware output
 */

export interface LogData {
  [key: string]: any;
}

export interface Logger {
  info: (message: string, data?: LogData) => void;
  warn: (message: string, data?: LogData) => void;
  error: (message: string, error?: Error | LogData) => void;
  debug: (message: string, data?: LogData) => void;
}

class PlatformLogger implements Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isTest = process.env.NODE_ENV === "test";

  private formatMessage(
    level: string,
    message: string,
    data?: LogData | Error
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data) {
      if (data instanceof Error) {
        return `${prefix} ${message} - Error: ${data.message}\nStack: ${data.stack}`;
      }
      return `${prefix} ${message} - Data: ${JSON.stringify(data, null, 2)}`;
    }

    return `${prefix} ${message}`;
  }

  info(message: string, data?: LogData): void {
    if (this.isTest) return;

    if (this.isDevelopment) {
      console.log(this.formatMessage("info", message, data));
    } else {
      // In production, you might want to send to a logging service
      // For now, we'll use console.log but in a structured way
      console.log(
        JSON.stringify({
          level: "info",
          message,
          data,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  warn(message: string, data?: LogData): void {
    if (this.isTest) return;

    if (this.isDevelopment) {
      console.warn(this.formatMessage("warn", message, data));
    } else {
      console.warn(
        JSON.stringify({
          level: "warn",
          message,
          data,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  error(message: string, error?: Error | LogData): void {
    if (this.isTest) return;

    if (this.isDevelopment) {
      console.error(this.formatMessage("error", message, error));
    } else {
      const errorData =
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error;

      console.error(
        JSON.stringify({
          level: "error",
          message,
          error: errorData,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  debug(message: string, data?: LogData): void {
    if (this.isTest) return;

    if (this.isDevelopment) {
      console.debug(this.formatMessage("debug", message, data));
    }
    // Debug logs are typically not shown in production
  }
}

// Export singleton instance
export const logger = new PlatformLogger();

// Export for testing purposes
export { PlatformLogger };
