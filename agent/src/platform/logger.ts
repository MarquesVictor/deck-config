const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof LEVELS)[number];

export interface Logger {
  trace(message: string): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  fatal(message: string): void;
}

/**
 * Minimal structured console logger. Swappable later for a file-backed
 * implementation (rotation, archive/) without touching call sites.
 */
export function createLogger(minLevel: LogLevel = "info"): Logger {
  const minIndex = LEVELS.indexOf(minLevel);

  const log = (level: LogLevel, message: string) => {
    if (LEVELS.indexOf(level) < minIndex) return;
    const line = `[${level.toUpperCase()}] ${message}`;
    if (level === "error" || level === "fatal") {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  return {
    trace: (m) => log("trace", m),
    debug: (m) => log("debug", m),
    info: (m) => log("info", m),
    warn: (m) => log("warn", m),
    error: (m) => log("error", m),
    fatal: (m) => log("fatal", m),
  };
}
