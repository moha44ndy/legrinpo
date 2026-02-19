/**
 * Logs structurés pour la prod (niveau, message, contexte).
 * En dev : affichage console. En prod : on peut brancher un service (Sentry, etc.).
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const ts = new Date().toISOString();
  const ctx = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  return `[${ts}] [${level.toUpperCase()}] ${message}${ctx}`;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const formatted = formatMessage(level, message, context);
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else if (process.env.NODE_ENV === 'development' || level === 'info') {
    console.info(formatted);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === 'development') log('debug', message, context);
  },
};
