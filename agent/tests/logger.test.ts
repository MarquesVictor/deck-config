import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../src/platform/logger";

describe("createLogger", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "streamdeck-logger-test-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("without a logsDir, never touches the filesystem", () => {
    const logger = createLogger("trace");
    logger.info("hello");
    logger.error("oops");

    expect(fs.existsSync(dir)).toBe(true); // sanity: dir itself untouched, still empty
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it("with a logsDir, writes info+ to agent.log and only error/fatal to error.log", () => {
    const logger = createLogger("info", dir);
    logger.info("just info");
    logger.warn("a warning");
    logger.error("an error");

    const agentLog = fs.readFileSync(path.join(dir, "agent.log"), "utf-8");
    expect(agentLog).toContain("just info");
    expect(agentLog).toContain("a warning");
    expect(agentLog).toContain("an error");

    const errorLog = fs.readFileSync(path.join(dir, "error.log"), "utf-8");
    expect(errorLog).not.toContain("just info");
    expect(errorLog).not.toContain("a warning");
    expect(errorLog).toContain("an error");
  });

  it("respects minLevel even when writing to file", () => {
    const logger = createLogger("warn", dir);
    logger.info("should be dropped");
    logger.warn("should appear");

    const agentLog = fs.readFileSync(path.join(dir, "agent.log"), "utf-8");
    expect(agentLog).not.toContain("should be dropped");
    expect(agentLog).toContain("should appear");
  });

  it("prefixes each line with an ISO timestamp and level", () => {
    const logger = createLogger("info", dir);
    logger.info("timestamped");

    const agentLog = fs.readFileSync(path.join(dir, "agent.log"), "utf-8");
    expect(agentLog).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[INFO] timestamped/);
  });
});
