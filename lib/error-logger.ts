interface LogEntry {
  error: any;
  context: string;
  action: string;
  level: 'error' | 'warn' | 'info';
  userId?: string;
  timestamp?: Date;
}

export class ErrorLogger {
  static log(entry: LogEntry): void {
    const logEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };

    // In development, log to console for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${logEntry.level.toUpperCase()}] ${logEntry.context}:`, {
        action: logEntry.action,
        error: logEntry.error,
        userId: logEntry.userId,
        timestamp: logEntry.timestamp,
      });
    }

    // In production, you could send to external logging service
    // Example: Sentry, LogRocket, or custom logging endpoint
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement production logging
      // Example: Sentry.captureException(logEntry.error, { extra: logEntry });
    }

    // Store in database for admin dashboard (optional)
    // This could be implemented later for error tracking
  }

  static warn(entry: Omit<LogEntry, 'level'>): void {
    this.log({ ...entry, level: 'warn' });
  }

  static info(entry: Omit<LogEntry, 'level'>): void {
    this.log({ ...entry, level: 'info' });
  }
}