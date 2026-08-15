import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { CURRENT_PROTOCOL_VERSION, type ResponseMessage } from "@stream-deck/shared";
import { ActionRegistry } from "../src/core/actions";
import { createOpenAppHandler } from "../src/core/actions/openApp";
import { JsonConfigStore } from "../src/core/persistence/jsonConfigStore";
import { RequestRouter } from "../src/core/requestRouter";
import { createLogger } from "../src/platform/logger";
import { startWebSocketServer, type StartedServer } from "../src/transport/websocket/server";

const MACHINE_ID = "machine_test1234";
const HARMLESS_EXECUTABLE = process.platform === "win32" ? "C:\\Windows\\System32\\cmd.exe" : "/usr/bin/true";

async function connectAndWaitForReady(port: number): Promise<WebSocket> {
  const socket = new WebSocket(`ws://localhost:${port}`);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => {
      socket.once("message", () => resolve()); // agent_ready event
    });
    socket.once("error", reject);
  });
  return socket;
}

function request(socket: WebSocket, message: Record<string, unknown>): Promise<ResponseMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timed out waiting for response")), 2000);
    socket.once("message", (raw) => {
      clearTimeout(timeout);
      resolve(JSON.parse(raw.toString()));
    });
    socket.send(JSON.stringify(message));
  });
}

describe("WebSocket protocol (integration)", () => {
  let dir: string;
  let server: StartedServer;
  let configStore: JsonConfigStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "streamdeck-ws-test-"));
    configStore = new JsonConfigStore(dir);
    const config = await configStore.loadConfig();
    await configStore.saveConfig({ ...config, machine: { ...config.machine, id: MACHINE_ID } });
    await configStore.saveApp({
      id: "app_test",
      name: "Test App",
      icon: "box",
      type: "application",
      action: { type: "open_app", path: HARMLESS_EXECUTABLE },
      position: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const logger = createLogger("error"); // keep test output quiet
    const registry = new ActionRegistry();
    registry.register("open_app", createOpenAppHandler(configStore, logger));
    const router = new RequestRouter(configStore, registry);

    server = await startWebSocketServer(
      { id: MACHINE_ID, name: "Test-PC", version: "1.0.0" },
      router,
      logger,
    );
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("handles a full get_apps request-response cycle", async () => {
    const socket = await connectAndWaitForReady(server.port);

    const response = await request(socket, {
      protocolVersion: CURRENT_PROTOCOL_VERSION,
      type: "request",
      requestId: randomUUID(),
      machineId: MACHINE_ID,
      action: "get_apps",
    });

    expect(response.success).toBe(true);
    expect((response.data as { apps: unknown[] }).apps).toHaveLength(1);
    socket.close();
  });

  it("rejects requests with an invalid machineId", async () => {
    const socket = await connectAndWaitForReady(server.port);

    const response = await request(socket, {
      protocolVersion: CURRENT_PROTOCOL_VERSION,
      type: "request",
      requestId: randomUUID(),
      machineId: "machine_wrong",
      action: "get_apps",
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("UNAUTHORIZED");
    socket.close();
  });

  it("executes an app and returns success", async () => {
    const socket = await connectAndWaitForReady(server.port);

    const response = await request(socket, {
      protocolVersion: CURRENT_PROTOCOL_VERSION,
      type: "request",
      requestId: randomUUID(),
      machineId: MACHINE_ID,
      action: "execute",
      payload: { appId: "app_test" },
    });

    expect(response.success).toBe(true);
    socket.close();
  });

  it("returns APPLICATION_NOT_FOUND for an unknown appId", async () => {
    const socket = await connectAndWaitForReady(server.port);

    const response = await request(socket, {
      protocolVersion: CURRENT_PROTOCOL_VERSION,
      type: "request",
      requestId: randomUUID(),
      machineId: MACHINE_ID,
      action: "execute",
      payload: { appId: "does_not_exist" },
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("APPLICATION_NOT_FOUND");
    socket.close();
  });
});
