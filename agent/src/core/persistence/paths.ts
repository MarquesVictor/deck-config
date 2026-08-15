import os from "node:os";
import path from "node:path";

/** %APPDATA%\StreamDeck on Windows; a dotfolder equivalent elsewhere (dev/test only). */
export function defaultConfigDir(): string {
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "StreamDeck");
  }
  return path.join(os.homedir(), ".streamdeck");
}

/** %LOCALAPPDATA%\StreamDeck\logs on Windows; a dotfolder equivalent elsewhere. */
export function defaultLogsDir(): string {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "StreamDeck", "logs");
  }
  return path.join(os.homedir(), ".streamdeck", "logs");
}
