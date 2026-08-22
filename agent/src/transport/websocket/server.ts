import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
  ActionErrorCode,
  CURRENT_PROTOCOL_VERSION,
  ProtocolError,
  type OutboundMessage,
  type RequestMessage,
} from "@stream-deck/shared";
import type { Logger } from "../../platform/logger";
import type { RequestRouter } from "../../core/requestRouter";
import { ConnectionManager } from "./connectionManager";

const FIRST_PORT = 38421;
const LAST_PORT = 38430;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
/** Older protocol majors the Agent still accepts, for backward compatibility. */
const SUPPORTED_PROTOCOL_VERSIONS = [1];

export interface AgentIdentityInfo {
  id: string;
  name: string;
  version: string;
}

export interface StartedServer {
  port: number;
  connectionManager: ConnectionManager;
  close: () => Promise<void>;
}

export async function startWebSocketServer(
  identity: AgentIdentityInfo,
  router: RequestRouter,
  logger: Logger,
): Promise<StartedServer> {
  const connectionManager = new ConnectionManager();

  for (let port = FIRST_PORT; port <= LAST_PORT; port++) {
    try {
      const wss = await tryListen(port);
      logger.info(`WebSocket listening on port ${port}`);
      wireServer(wss, identity, router, connectionManager, logger);
      const heartbeat = setInterval(
        () => runHeartbeat(connectionManager, logger),
        HEARTBEAT_INTERVAL_MS,
      );
      return {
        port,
        connectionManager,
        close: () =>
          new Promise((resolve, reject) => {
            clearInterval(heartbeat);
            wss.close((err) => (err ? reject(err) : resolve()));
          }),
      };
    } catch (err) {
      if (isPortInUseError(err)) {
        logger.info(`WebSocket port ${port} already in use`);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`No available port in range ${FIRST_PORT}-${LAST_PORT}`);
}

function tryListen(port: number): Promise<WebSocketServer> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port });
    wss.once("listening", () => {
      wss.removeAllListeners("error");
      resolve(wss);
    });
    wss.once("error", reject);
  });
}

function isPortInUseError(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && (err as { code?: string }).code === "EADDRINUSE"
  );
}

function wireServer(
  wss: WebSocketServer,
  identity: AgentIdentityInfo,
  router: RequestRouter,
  connectionManager: ConnectionManager,
  logger: Logger,
): void {
  wss.on("connection", (socket, req) => {
    const clientId = randomUUID();
    connectionManager.add(clientId, socket);
    logger.info(
      `New WebSocket connection from ${req.socket.remoteAddress}:${req.socket.remotePort}`,
    );

    send(socket, {
      type: "event",
      event: "agent_ready",
      agent: {
        id: identity.id,
        name: identity.name,
        version: identity.version,
        protocolVersion: CURRENT_PROTOCOL_VERSION,
      },
    });

    socket.on("message", (raw) => {
      void handleMessage(raw.toString(), identity, router, connectionManager, clientId, logger);
    });

    socket.on("close", () => {
      connectionManager.remove(clientId);
      logger.info(`Client disconnected: ${clientId}`);
    });

    socket.on("error", (err) => {
      logger.warn(`Socket error for ${clientId}: ${err.message}`);
    });
  });
}

async function handleMessage(
  raw: string,
  identity: AgentIdentityInfo,
  router: RequestRouter,
  connectionManager: ConnectionManager,
  clientId: string,
  logger: Logger,
): Promise<void> {
  const connection = connectionManager.get(clientId);
  if (!connection) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn(`Received invalid JSON from ${clientId}`);
    return;
  }

  const envelope = parsed as { type?: string; requestId?: string };

  if (envelope.type === "pong") {
    connection.lastPongAt = Date.now();
    return;
  }

  if (envelope.type !== "request") {
    logger.warn(`Ignoring unsupported message type from ${clientId}: ${envelope.type}`);
    return;
  }

  const request = parsed as RequestMessage;
  const requestId = request.requestId ?? "unknown";
  logger.info(
    `Request ${requestId} received: action=${request.action} payload=${JSON.stringify(request.payload)}`,
  );

  try {
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(request.protocolVersion)) {
      throw new ProtocolError(
        ActionErrorCode.PROTOCOL_VERSION_MISMATCH,
        "Versão de protocolo incompatível.",
      );
    }
    if (request.machineId !== identity.id) {
      throw new ProtocolError(ActionErrorCode.UNAUTHORIZED, "Dispositivo não autorizado.");
    }
    connection.authenticated = true;

    const data = await router.handle(request);
    logger.info(`Request ${requestId} succeeded`);
    send(connection.socket, { type: "response", requestId, success: true, data });
  } catch (err) {
    const error = toErrorPayload(err);
    const detailsSuffix =
      error.details !== undefined ? ` | details: ${JSON.stringify(error.details)}` : "";
    logger.error(`Request ${requestId} failed: ${error.code} - ${error.message}${detailsSuffix}`);
    send(connection.socket, { type: "response", requestId, success: false, error });
  }
}

function toErrorPayload(err: unknown) {
  if (err instanceof ProtocolError) {
    return {
      code: err.code,
      message: err.message,
      timestamp: new Date().toISOString(),
      details: err.details,
    };
  }
  const message = err instanceof Error ? err.message : "Erro desconhecido.";
  return {
    code: ActionErrorCode.INTERNAL_ERROR,
    message: "Ocorreu um erro interno no Agent.",
    timestamp: new Date().toISOString(),
    details: message,
  };
}

function runHeartbeat(connectionManager: ConnectionManager, logger: Logger): void {
  const now = Date.now();
  for (const connection of connectionManager.list()) {
    if (now - connection.lastPongAt > HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS) {
      logger.warn(`Client ${connection.clientId} missed heartbeat, terminating`);
      connection.socket.terminate();
      connectionManager.remove(connection.clientId);
      continue;
    }
    send(connection.socket, { type: "ping", timestamp: now });
  }
}

function send(socket: WebSocket, message: OutboundMessage): void {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(message));
}
