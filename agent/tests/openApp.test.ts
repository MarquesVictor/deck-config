import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtocolError } from "@stream-deck/shared";
import { JsonConfigStore } from "../src/core/persistence/jsonConfigStore";
import { createLogger } from "../src/platform/logger";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// createOpenAppHandler must be imported after the mock is registered.
const { createOpenAppHandler } = await import("../src/core/actions/openApp");

class FakeChild extends EventEmitter {
  pid = 4242;
  unref = vi.fn();
}

function mockSpawnSucceeds() {
  spawnMock.mockImplementation(() => {
    const child = new FakeChild();
    queueMicrotask(() => child.emit("spawn"));
    return child;
  });
}

function mockSpawnFails(message: string) {
  spawnMock.mockImplementation(() => {
    const child = new FakeChild();
    queueMicrotask(() => child.emit("error", new Error(message)));
    return child;
  });
}

describe("openApp handler", () => {
  let dir: string;
  let configStore: JsonConfigStore;
  const logger = createLogger("error");

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "streamdeck-openapp-test-"));
    configStore = new JsonConfigStore(dir);
    spawnMock.mockReset();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function seedApp(execPath: string) {
    const now = new Date().toISOString();
    await configStore.saveApp({
      id: "app_test",
      name: "Test",
      icon: "box",
      type: "application",
      action: { type: "open_app", path: execPath },
      position: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  it("throws APPLICATION_NOT_FOUND when the appId isn't in the store", async () => {
    const handler = createOpenAppHandler(configStore, logger);

    await expect(handler({ appId: "does_not_exist" })).rejects.toMatchObject({
      code: "APPLICATION_NOT_FOUND",
    });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("throws APPLICATION_NOT_FOUND when the configured path doesn't exist on disk", async () => {
    await seedApp(path.join(dir, "nonexistent-binary"));
    const handler = createOpenAppHandler(configStore, logger);

    await expect(handler({ appId: "app_test" })).rejects.toMatchObject({
      code: "APPLICATION_NOT_FOUND",
    });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("spawns the executable directly for a normal (non-.app) path", async () => {
    const execPath = path.join(dir, "app.exe");
    await fs.writeFile(execPath, "");
    await seedApp(execPath);
    mockSpawnSucceeds();

    await createOpenAppHandler(configStore, logger)({ appId: "app_test" });

    expect(spawnMock).toHaveBeenCalledWith(
      execPath,
      [],
      expect.objectContaining({ detached: true }),
    );
  });

  it("throws APPLICATION_LAUNCH_FAILED when spawn errors", async () => {
    const execPath = path.join(dir, "app.exe");
    await fs.writeFile(execPath, "");
    await seedApp(execPath);
    mockSpawnFails("EACCES: permission denied");

    const handler = createOpenAppHandler(configStore, logger);
    const error: ProtocolError = await handler({ appId: "app_test" }).catch((e) => e);

    expect(error).toBeInstanceOf(ProtocolError);
    expect(error.code).toBe("APPLICATION_LAUNCH_FAILED");
  });

  it.runIf(process.platform === "darwin")(
    "routes .app bundle paths through `open` instead of spawning the bundle directly",
    async () => {
      const bundlePath = path.join(dir, "Something.app");
      await fs.mkdir(bundlePath);
      await seedApp(bundlePath);
      mockSpawnSucceeds();

      await createOpenAppHandler(configStore, logger)({ appId: "app_test" });

      expect(spawnMock).toHaveBeenCalledWith(
        "/usr/bin/open",
        [bundlePath],
        expect.objectContaining({ detached: true }),
      );
    },
  );
});
