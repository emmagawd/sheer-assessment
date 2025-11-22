/* eslint-disable no-console */
/**
 * Simple logging wrapper
 * For production, consider using Winston or similar
 */
const logger = {
  info: (message: string, meta?: unknown): void => {
    console.log(`[INFO] ${message}`, meta || '');
  },
  warn: (message: string, meta?: unknown): void => {
    console.warn(`[WARN] ${message}`, meta || '');
  },
  error: (message: string, meta?: unknown): void => {
    console.error(`[ERROR] ${message}`, meta || '');
  },
  debug: (message: string, meta?: unknown): void => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, meta || '');
    }
  },
};

export default logger;
