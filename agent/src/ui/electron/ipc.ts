import type { App } from "@stream-deck/shared";
import type { AgentSettings } from "../../core/models/AgentConfig";
import type { AppInput, ConnectedClientInfo, MachineInfo } from "../../core/agentService";

export type { AgentSettings } from "../../core/models/AgentConfig";
export type { AppInput, ConnectedClientInfo, MachineInfo } from "../../core/agentService";

export const IPC_CHANNELS = {
  listApps: "apps:list",
  addApp: "apps:add",
  updateApp: "apps:update",
  deleteApp: "apps:delete",
  reorderApps: "apps:reorder",
  testApp: "apps:test",
  getConnectedClients: "clients:list",
  getSettings: "settings:get",
  updateSettings: "settings:update",
  getMachineInfo: "machine:info",
  pickExecutable: "dialog:pickExecutable",
} as const;

/** Renderer -> main invoke contract. Keeps preload.ts and main.ts in sync by construction. */
export interface StreamDeckApi {
  listApps: () => Promise<App[]>;
  addApp: (input: AppInput) => Promise<App>;
  updateApp: (id: string, input: AppInput) => Promise<App>;
  deleteApp: (id: string) => Promise<void>;
  reorderApps: (orderedIds: string[]) => Promise<void>;
  testApp: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  getConnectedClients: () => Promise<ConnectedClientInfo[]>;
  getSettings: () => Promise<AgentSettings>;
  updateSettings: (patch: Partial<AgentSettings>) => Promise<AgentSettings>;
  getMachineInfo: () => Promise<MachineInfo>;
  pickExecutable: () => Promise<string | null>;
}

declare global {
  interface Window {
    streamDeck: StreamDeckApi;
  }
}
