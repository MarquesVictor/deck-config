import type { App } from "@stream-deck/shared";
import type { AgentConfig } from "../models/AgentConfig";

export interface IConfigStore {
  loadConfig(): Promise<AgentConfig>;
  saveConfig(config: AgentConfig): Promise<void>;
  loadApp(appId: string): Promise<App | null>;
  saveApp(app: App): Promise<void>;
  deleteApp(appId: string): Promise<void>;
}
