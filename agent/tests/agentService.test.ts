import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { AgentService } from "../src/core/agentService";
import { ActionRegistry } from "../src/core/actions";
import { JsonConfigStore } from "../src/core/persistence/jsonConfigStore";
import { ConnectionManager } from "../src/transport/websocket/connectionManager";

function fakeSocket() {
  return { readyState: 1, OPEN: 1, send: vi.fn() } as unknown as WebSocket;
}

describe("AgentService", () => {
  let dir: string;
  let configStore: JsonConfigStore;
  let actionRegistry: ActionRegistry;
  let connectionManager: ConnectionManager;
  let service: AgentService;
  let openAppHandler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "streamdeck-agentservice-test-"));
    configStore = new JsonConfigStore(dir);
    await configStore.loadConfig(); // materializes machine identity + defaults

    actionRegistry = new ActionRegistry();
    openAppHandler = vi.fn().mockResolvedValue(undefined);
    actionRegistry.register("open_app", openAppHandler);

    connectionManager = new ConnectionManager();
    service = new AgentService(configStore, actionRegistry, connectionManager, {
      id: "machine_test",
      name: "Test-PC",
      port: 38421,
      ipAddresses: ["192.168.1.10"],
    });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("starts with an empty app list", async () => {
    expect(await service.listApps()).toEqual([]);
  });

  it("addApp creates an app, assigns position, and broadcasts apps_updated to authenticated clients only", async () => {
    const authenticated = connectionManager.add("client_auth", fakeSocket());
    authenticated.authenticated = true;
    const unauthenticated = connectionManager.add("client_unauth", fakeSocket());
    unauthenticated.authenticated = false;

    const app = await service.addApp({
      name: "Notepad",
      icon: "document",
      path: "C:\\notepad.exe",
    });

    expect(app.id).toMatch(/^app_/);
    expect(app.position).toBe(0);
    expect(app.action).toEqual({ type: "open_app", path: "C:\\notepad.exe" });

    const apps = await service.listApps();
    expect(apps).toEqual([app]);

    expect(authenticated.socket.send).toHaveBeenCalledTimes(1);
    const [sentRaw] = (authenticated.socket.send as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const sent = JSON.parse(sentRaw);
    expect(sent).toMatchObject({ type: "event", event: "apps_updated" });
    expect(sent.apps).toHaveLength(1);
    expect(sent.apps[0]).not.toHaveProperty("action"); // summaries never leak the filesystem path

    expect(unauthenticated.socket.send).not.toHaveBeenCalled();
  });

  it("addApp assigns increasing positions in insertion order", async () => {
    const first = await service.addApp({ name: "A", icon: "box", path: "/a" });
    const second = await service.addApp({ name: "B", icon: "box", path: "/b" });

    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
  });

  it("updateApp changes fields and updatedAt but preserves id/createdAt/position", async () => {
    const created = await service.addApp({ name: "Old", icon: "box", path: "/old" });

    await new Promise((r) => setTimeout(r, 2)); // ensure updatedAt differs from createdAt
    const updated = await service.updateApp(created.id, { name: "New", icon: "key", path: "/new" });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.position).toBe(created.position);
    expect(updated.name).toBe("New");
    expect(updated.icon).toBe("key");
    expect(updated.action).toEqual({ type: "open_app", path: "/new" });
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  it("updateApp throws for an unknown id", async () => {
    await expect(
      service.updateApp("app_missing", { name: "X", icon: "box", path: "/x" }),
    ).rejects.toThrow("App not found");
  });

  it("deleteApp removes the app and broadcasts the update", async () => {
    const client = connectionManager.add("client_1", fakeSocket());
    client.authenticated = true;

    const app = await service.addApp({ name: "Gone", icon: "box", path: "/gone" });
    (client.socket.send as ReturnType<typeof vi.fn>).mockClear();

    await service.deleteApp(app.id);

    expect(await service.listApps()).toEqual([]);
    expect(client.socket.send).toHaveBeenCalledTimes(1);
  });

  it("reorderApps updates positions to match the given order", async () => {
    const a = await service.addApp({ name: "A", icon: "box", path: "/a" });
    const b = await service.addApp({ name: "B", icon: "box", path: "/b" });
    const c = await service.addApp({ name: "C", icon: "box", path: "/c" });

    await service.reorderApps([c.id, a.id, b.id]);

    const apps = await service.listApps();
    expect(apps.map((app) => app.id)).toEqual([c.id, a.id, b.id]);
    expect(apps.map((app) => app.position)).toEqual([0, 1, 2]);
  });

  it("testApp runs the app's action handler with its id as payload", async () => {
    const app = await service.addApp({ name: "Runme", icon: "box", path: "/runme" });

    await service.testApp(app.id);

    expect(openAppHandler).toHaveBeenCalledWith({ appId: app.id });
  });

  it("testApp throws for an unknown id without invoking any handler", async () => {
    await expect(service.testApp("app_missing")).rejects.toThrow("App not found");
    expect(openAppHandler).not.toHaveBeenCalled();
  });

  it("getConnectedClients reflects the connection manager's state", async () => {
    const c1 = connectionManager.add("client_1", fakeSocket());
    c1.authenticated = true;
    connectionManager.add("client_2", fakeSocket());

    const clients = service.getConnectedClients();

    expect(clients).toHaveLength(2);
    expect(clients.find((c) => c.clientId === "client_1")?.authenticated).toBe(true);
    expect(clients.find((c) => c.clientId === "client_2")?.authenticated).toBe(false);
  });

  it("getSettings returns the persisted defaults", async () => {
    const settings = await service.getSettings();
    expect(settings).toMatchObject({
      autoStartWindows: true,
      startMinimized: true,
      showInTray: true,
    });
  });

  it("updateSettings persists a partial patch and returns the merged result", async () => {
    const updated = await service.updateSettings({ logLevel: "debug" });

    expect(updated.logLevel).toBe("debug");
    expect(updated.autoStartWindows).toBe(true); // untouched fields survive

    const reloaded = await service.getSettings();
    expect(reloaded.logLevel).toBe("debug");
  });

  it("getMachineInfo returns what the service was constructed with", () => {
    expect(service.getMachineInfo()).toEqual({
      id: "machine_test",
      name: "Test-PC",
      port: 38421,
      ipAddresses: ["192.168.1.10"],
    });
  });
});
