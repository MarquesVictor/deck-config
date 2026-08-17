import { randomUUID } from "node:crypto";
import { toAppSummary, type App } from "@stream-deck/shared";
import type { ActionRegistry } from "./actions";
import type { AgentSettings } from "./models/AgentConfig";
import type { IConfigStore } from "./persistence/configStore";
import type { ConnectionManager } from "../transport/websocket/connectionManager";

export interface AppInput {
  name: string;
  icon: string;
  iconImage?: string;
  path: string;
}

export interface ConnectedClientInfo {
  clientId: string;
  authenticated: boolean;
  connectedAt: number;
}

export interface MachineInfo {
  id: string;
  name: string;
  port: number;
  ipAddresses: string[];
}

/**
 * UI-facing operations for the Electron renderer (via IPC). Wraps the same
 * ConfigStore/ActionRegistry the WebSocket server uses, so the Agent app and
 * connected phones are always looking at one source of truth.
 */
export class AgentService {
  constructor(
    private readonly configStore: IConfigStore,
    private readonly actionRegistry: ActionRegistry,
    private readonly connectionManager: ConnectionManager,
    private readonly machine: MachineInfo,
  ) {}

  getMachineInfo(): MachineInfo {
    return this.machine;
  }

  async listApps(): Promise<App[]> {
    const config = await this.configStore.loadConfig();
    return [...config.apps].sort((a, b) => a.position - b.position);
  }

  async addApp(input: AppInput): Promise<App> {
    const apps = await this.listApps();
    const now = new Date().toISOString();
    const app: App = {
      id: `app_${randomUUID().split("-")[0]}`,
      name: input.name,
      icon: input.icon,
      iconImage: input.iconImage,
      type: "application",
      action: { type: "open_app", path: input.path },
      position: apps.length,
      createdAt: now,
      updatedAt: now,
    };
    await this.configStore.saveApp(app);
    await this.broadcastAppsUpdated();
    return app;
  }

  async updateApp(id: string, input: AppInput): Promise<App> {
    const existing = await this.configStore.loadApp(id);
    if (!existing) throw new Error(`App not found: ${id}`);

    const updated: App = {
      ...existing,
      name: input.name,
      icon: input.icon,
      iconImage: input.iconImage,
      action: { type: "open_app", path: input.path },
      updatedAt: new Date().toISOString(),
    };
    await this.configStore.saveApp(updated);
    await this.broadcastAppsUpdated();
    return updated;
  }

  async deleteApp(id: string): Promise<void> {
    await this.configStore.deleteApp(id);
    await this.broadcastAppsUpdated();
  }

  async reorderApps(orderedIds: string[]): Promise<void> {
    const config = await this.configStore.loadConfig();
    const byId = new Map(config.apps.map((app) => [app.id, app]));
    const now = new Date().toISOString();

    for (let position = 0; position < orderedIds.length; position++) {
      const app = byId.get(orderedIds[position]!);
      if (!app) continue;
      await this.configStore.saveApp({ ...app, position, updatedAt: now });
    }
    await this.broadcastAppsUpdated();
  }

  /** Runs the app's action immediately, the same way a phone's "execute" request would. */
  async testApp(id: string): Promise<void> {
    const app = await this.configStore.loadApp(id);
    if (!app) throw new Error(`App not found: ${id}`);
    await this.actionRegistry.execute(app.action.type, { appId: id });
  }

  getConnectedClients(): ConnectedClientInfo[] {
    return this.connectionManager.list().map((c) => ({
      clientId: c.clientId,
      authenticated: c.authenticated,
      connectedAt: c.connectedAt,
    }));
  }

  async getSettings(): Promise<AgentSettings> {
    const config = await this.configStore.loadConfig();
    return config.settings;
  }

  async updateSettings(patch: Partial<AgentSettings>): Promise<AgentSettings> {
    const config = await this.configStore.loadConfig();
    const settings = { ...config.settings, ...patch };
    await this.configStore.saveConfig({ ...config, settings });
    return settings;
  }

  private async broadcastAppsUpdated(): Promise<void> {
    const apps = await this.listApps();
    this.connectionManager.broadcast(
      { type: "event", event: "apps_updated", apps: apps.map(toAppSummary) },
      { authenticatedOnly: true },
    );
  }
}
