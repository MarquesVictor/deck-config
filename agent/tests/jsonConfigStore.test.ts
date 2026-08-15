import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonConfigStore } from "../src/core/persistence/jsonConfigStore";

describe("JsonConfigStore", () => {
  let dir: string;
  let store: JsonConfigStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "streamdeck-test-"));
    store = new JsonConfigStore(dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("creates a default config with a persistent machine id on first load", async () => {
    const config = await store.loadConfig();
    expect(config.machine.id).toMatch(/^machine_/);

    const reloaded = await store.loadConfig();
    expect(reloaded.machine.id).toBe(config.machine.id);
  });

  it("saves and retrieves an app by id", async () => {
    const app = {
      id: "app_notepad",
      name: "Notepad",
      icon: "document",
      type: "application" as const,
      action: { type: "open_app" as const, path: "C:\\Windows\\notepad.exe" },
      position: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.saveApp(app);
    const loaded = await store.loadApp("app_notepad");

    expect(loaded).toEqual(app);
  });

  it("deletes an app", async () => {
    const app = {
      id: "app_notepad",
      name: "Notepad",
      icon: "document",
      type: "application" as const,
      action: { type: "open_app" as const, path: "C:\\Windows\\notepad.exe" },
      position: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.saveApp(app);

    await store.deleteApp("app_notepad");

    expect(await store.loadApp("app_notepad")).toBeNull();
  });

  it("restores from backup when the primary config is corrupted", async () => {
    await store.loadConfig();
    const app = {
      id: "app_a",
      name: "A",
      icon: "box",
      type: "application" as const,
      action: { type: "open_app" as const, path: "/bin/a" },
      position: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.saveApp(app); // primary now has app_a, backup has the pristine default

    // Corrupt the primary file directly.
    await fs.writeFile(path.join(dir, "config.json"), "{not valid json", "utf-8");

    const recovered = await store.loadConfig();
    expect(recovered.apps).toEqual([]); // recovered from the backup taken before saveApp
  });
});
