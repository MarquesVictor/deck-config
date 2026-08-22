import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const MAX_LOG_BYTES = 10 * 1024 * 1024; // 10 MB
const RETENTION_DAYS = 7;

/** If `filePath` is at/over the size cap, gzips it into `archiveDir` and truncates it to empty. */
export function rotateIfNeeded(filePath: string, archiveDir: string): void {
  if (!fs.existsSync(filePath)) return;
  if (fs.statSync(filePath).size < MAX_LOG_BYTES) return;

  fs.mkdirSync(archiveDir, { recursive: true });
  const base = path.basename(filePath, path.extname(filePath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = path.join(archiveDir, `${base}-${timestamp}.log.gz`);

  fs.writeFileSync(archivePath, zlib.gzipSync(fs.readFileSync(filePath)));
  fs.writeFileSync(filePath, "");
}

/** Deletes archived logs older than the retention window. */
export function cleanOldArchives(archiveDir: string): void {
  if (!fs.existsSync(archiveDir)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(archiveDir)) {
    const fullPath = path.join(archiveDir, entry);
    if (fs.statSync(fullPath).mtimeMs < cutoff) fs.unlinkSync(fullPath);
  }
}
