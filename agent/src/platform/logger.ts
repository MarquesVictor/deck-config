import fs from "node:fs";
import path from "node:path";
import { cleanOldArchives, rotateIfNeeded } from "./logRotation";

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
 * Structured logger: always writes to console; also writes to
 * `<logsDir>/agent.log` (everything) and `<logsDir>/error.log`
 * (error/fatal only) when `logsDir` is given. Omitting `logsDir` (as every
 * test does) keeps this console-only with no filesystem side effects.
 */
export function createLogger(minLevel: LogLevel = "info", logsDir?: string): Logger {
  const minIndex = LEVELS.indexOf(minLevel);

  let agentLogPath: string | undefined;
  let errorLogPath: string | undefined;
  if (logsDir) {
    fs.mkdirSync(logsDir, { recursive: true });
    agentLogPath = path.join(logsDir, "agent.log");
    errorLogPath = path.join(logsDir, "error.log");
    cleanOldArchives(path.join(logsDir, "archive"));
  }

  const writeToFile = (filePath: string, line: string) => {
    rotateIfNeeded(filePath, path.join(path.dirname(filePath), "archive"));
    fs.appendFileSync(filePath, line + "\n");
  };

  const log = (level: LogLevel, message: string) => {
    if (LEVELS.indexOf(level) < minIndex) return;
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;

    if (level === "error" || level === "fatal") {
      console.error(line);
    } else {
      console.log(line);
    }

    if (agentLogPath) writeToFile(agentLogPath, line);
    if (errorLogPath && (level === "error" || level === "fatal")) writeToFile(errorLogPath, line);
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
