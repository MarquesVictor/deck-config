import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanOldArchives, rotateIfNeeded } from "../src/platform/logRotation";

describe("logRotation", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "streamdeck-logrotation-test-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe("rotateIfNeeded", () => {
    it("does nothing when the file doesn't exist", () => {
      const filePath = path.join(dir, "agent.log");
      const archiveDir = path.join(dir, "archive");

      expect(() => rotateIfNeeded(filePath, archiveDir)).not.toThrow();
      expect(fs.existsSync(archiveDir)).toBe(false);
    });

    it("does nothing when the file is under the size cap", () => {
      const filePath = path.join(dir, "agent.log");
      const archiveDir = path.join(dir, "archive");
      fs.writeFileSync(filePath, "a small log line\n");

      rotateIfNeeded(filePath, archiveDir);

      expect(fs.readFileSync(filePath, "utf-8")).toBe("a small log line\n");
      expect(fs.existsSync(archiveDir)).toBe(false);
    });

    it("archives (gzipped) and truncates the file once it's at/over the cap", () => {
      const filePath = path.join(dir, "agent.log");
      const archiveDir = path.join(dir, "archive");
      const content = Buffer.alloc(11 * 1024 * 1024, "x"); // over the 10 MB cap
      fs.writeFileSync(filePath, content);

      rotateIfNeeded(filePath, archiveDir);

      expect(fs.readFileSync(filePath, "utf-8")).toBe(""); // truncated
      const archived = fs.readdirSync(archiveDir);
      expect(archived).toHaveLength(1);
      expect(archived[0]).toMatch(/^agent-.*\.log\.gz$/);

      const decompressed = zlib.gunzipSync(fs.readFileSync(path.join(archiveDir, archived[0]!)));
      expect(decompressed.equals(content)).toBe(true);
    });
  });

  describe("cleanOldArchives", () => {
    it("does nothing when the archive dir doesn't exist", () => {
      expect(() => cleanOldArchives(path.join(dir, "archive"))).not.toThrow();
    });

    it("deletes files older than the retention window, keeps newer ones", () => {
      const archiveDir = path.join(dir, "archive");
      fs.mkdirSync(archiveDir);

      const oldFile = path.join(archiveDir, "old.log.gz");
      const newFile = path.join(archiveDir, "new.log.gz");
      fs.writeFileSync(oldFile, "old");
      fs.writeFileSync(newFile, "new");

      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      fs.utimesSync(oldFile, new Date(eightDaysAgo), new Date(eightDaysAgo));

      cleanOldArchives(archiveDir);

      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(newFile)).toBe(true);
    });
  });
});
