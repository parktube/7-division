/**
 * Simple logger abstraction
 * - Development: console output
 * - Production: can be replaced with proper logging (Winston, Pino, Sentry, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV !== 'production';

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(formatMessage('debug', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(formatMessage('info', message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.warn(formatMessage('warn', message, context));
  },

  error(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.error(formatMessage('error', message, context));
    // TODO: In production, send to error tracking service (Sentry, etc.)
  },
};
