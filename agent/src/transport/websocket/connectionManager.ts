import type { WebSocket } from "ws";
import type { OutboundMessage } from "@stream-deck/shared";

export interface ClientConnection {
  clientId: string;
  socket: WebSocket;
  authenticated: boolean;
  connectedAt: number;
  lastPongAt: number;
}

export class ConnectionManager {
  private readonly connections = new Map<string, ClientConnection>();

  add(clientId: string, socket: WebSocket): ClientConnection {
    const connection: ClientConnection = {
      clientId,
      socket,
      authenticated: false,
      connectedAt: Date.now(),
      lastPongAt: Date.now(),
    };
    this.connections.set(clientId, connection);
    return connection;
  }

  remove(clientId: string): void {
    this.connections.delete(clientId);
  }

  get(clientId: string): ClientConnection | undefined {
    return this.connections.get(clientId);
  }

  list(): ClientConnection[] {
    return [...this.connections.values()];
  }

  send(clientId: string, message: OutboundMessage): void {
    const connection = this.connections.get(clientId);
    if (!connection || connection.socket.readyState !== connection.socket.OPEN) return;
    connection.socket.send(JSON.stringify(message));
  }

  broadcast(message: OutboundMessage, opts: { authenticatedOnly?: boolean } = {}): void {
    for (const connection of this.connections.values()) {
      if (opts.authenticatedOnly && !connection.authenticated) continue;
      if (connection.socket.readyState !== connection.socket.OPEN) continue;
      connection.socket.send(JSON.stringify(message));
    }
  }
}
