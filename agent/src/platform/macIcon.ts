import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ICON_SIZE_PX = 64;

/**
 * Electron's app.getFileIcon() resolves .app bundle icons by MIME type on
 * macOS and returns a generic icon instead of the bundle's real one
 * (a known, longstanding Electron limitation). This shells out to the same
 * AppKit API Finder itself uses instead: NSWorkspace.iconForFile via a JXA
 * script, then downsizes the result with `sips` (both real icons can come
 * back at 512-1024px, far bigger than needed for a button).
 */
export async function extractMacAppIcon(targetPath: string, assetsDir: string): Promise<string | null> {
  // NSWorkspace.iconForFile never errors for a missing path — it returns a
  // generic "unknown file" icon instead — so existence has to be checked
  // ourselves to avoid treating that placeholder as a real icon.
  try {
    await fs.access(targetPath);
  } catch {
    return null;
  }

  const script = path.join(assetsDir, "extract-mac-icon.jxa.js");
  const tmpFile = path.join(os.tmpdir(), `streamdeck-icon-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);

  try {
    await execFileAsync("/usr/bin/osascript", ["-l", "JavaScript", script, targetPath, tmpFile]);
    await execFileAsync("/usr/bin/sips", ["-Z", String(ICON_SIZE_PX), tmpFile]);
    const buffer = await fs.readFile(tmpFile);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}
