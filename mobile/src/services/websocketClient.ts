import {
  ActionErrorCode,
  CURRENT_PROTOCOL_VERSION,
  OutboundMessageSchema,
  ProtocolError,
  type AppSummary,
  type RequestAction,
} from "@stream-deck/shared";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export interface AgentInfo {
  id: string;
  name: string;
  version: string;
}

const CONNECT_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 10000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
const GIVE_UP_AFTER_MS = 5 * 60 * 1000;

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Owns a single WebSocket connection to a Stream Deck Agent: handshake,
 * request/response correlation, ping/pong heartbeat, and reconnection with
 * backoff. One instance per active (or attempted) connection.
 */
export class AgentClient {
  private socket: WebSocket | null = null;
  private host: string | null = null;
  private port: number | null = null;
  private machineId: string | null = null;

  private status: ConnectionStatus = "disconnected";
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();
  private readonly appsUpdatedListeners = new Set<(apps: AppSummary[]) => void>();
  private readonly pendingRequests = new Map<string, PendingRequest>();

  private reconnectAttempt = 0;
  private reconnectDeadline: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  connect(host: string, port: number): Promise<AgentInfo> {
    this.host = host;
    this.port = port;
    this.intentionalDisconnect = false;
    this.reconnectAttempt = 0;
    this.reconnectDeadline = null;
    return this.attemptConnection();
  }

  /** Re-attempt after the reconnect loop gave up ("Tentar novamente"). */
  retry(): Promise<AgentInfo> {
    this.intentionalDisconnect = false;
    this.reconnectAttempt = 0;
    this.reconnectDeadline = null;
    return this.attemptConnection();
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectDeadline = null;
    this.socket?.close();
    this.socket = null;
    this.setStatus("disconnected");
  }

  async request<T = unknown>(action: RequestAction, payload?: unknown): Promise<T> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.machineId) {
      throw new Error("Não conectado ao computador.");
    }

    const requestId = generateId();
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Tempo esgotado aguardando resposta do computador."));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timeout,
      });

      this.send({
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        type: "request",
        requestId,
        machineId: this.machineId!,
        action,
        payload,
      });
    });
  }

  onStatusChange(cb: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  onAppsUpdated(cb: (apps: AppSummary[]) => void): () => void {
    this.appsUpdatedListeners.add(cb);
    return () => this.appsUpdatedListeners.delete(cb);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private attemptConnection(): Promise<AgentInfo> {
    this.setStatus(this.reconnectAttempt === 0 ? "connecting" : "reconnecting");

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://${this.host}:${this.port}`);
      this.socket = socket;
      let settled = false;

      const connectTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        reject(new Error("Tempo esgotado ao conectar."));
      }, CONNECT_TIMEOUT_MS);

      socket.onmessage = (event) => {
        const message = parseMessage(event.data as string);
        if (!message) return;

        if (message.type === "event" && message.event === "agent_ready") {
          this.machineId = message.agent.id;
          clearTimeout(connectTimeout);
          if (!settled) {
            settled = true;
            this.reconnectAttempt = 0;
            this.reconnectDeadline = null;
            this.setStatus("connected");
            resolve({ id: message.agent.id, name: message.agent.name, version: message.agent.version });
          }
          return;
        }

        this.handleMessage(message);
      };

      socket.onclose = () => {
        clearTimeout(connectTimeout);
        this.rejectAllPending(new Error("Conexão perdida."));
        this.socket = null;

        if (!settled) {
          settled = true;
          reject(new Error("Não foi possível conectar ao computador."));
        }

        if (this.intentionalDisconnect) {
          this.setStatus("disconnected");
        } else {
          this.scheduleReconnect();
        }
      };

      // onerror is always followed by onclose for browser-standard WebSocket; no separate handling needed.
      socket.onerror = () => {};
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectDeadline === null) {
      this.reconnectDeadline = Date.now() + GIVE_UP_AFTER_MS;
    }
    if (Date.now() >= this.reconnectDeadline) {
      this.reconnectDeadline = null;
      this.setStatus("failed");
      return;
    }

    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]!;
    this.reconnectAttempt++;
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.attemptConnection().catch(() => {
        // onclose already re-schedules the next attempt; nothing further to do here.
      });
    }, delay);
  }

  private handleMessage(message: ReturnType<typeof parseMessage>): void {
    if (!message) return;

    if (message.type === "ping") {
      this.send({ type: "pong", timestamp: message.timestamp });
      return;
    }

    if (message.type === "response") {
      const pending = this.pendingRequests.get(message.requestId);
      if (!pending) return;
      this.pendingRequests.delete(message.requestId);
      clearTimeout(pending.timeout);

      if (message.success) {
        pending.resolve(message.data);
      } else {
        const error = message.error;
        pending.reject(
          new ProtocolError(
            error?.code ?? ActionErrorCode.INTERNAL_ERROR,
            error?.message ?? "Erro desconhecido.",
          ),
        );
      }
      return;
    }

    if (message.type === "event" && message.event === "apps_updated") {
      const apps = message.apps as AppSummary[];
      this.appsUpdatedListeners.forEach((cb) => cb(apps));
    }
  }

  private rejectAllPending(err: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  private send(message: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }
}

function parseMessage(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    const result = OutboundMessageSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function generateId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
