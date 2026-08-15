import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { App } from "@stream-deck/shared";
import { AgentConfigSchema, createDefaultConfig, type AgentConfig } from "../models/AgentConfig";
import type { IConfigStore } from "./configStore";
import { defaultConfigDir } from "./paths";

export class JsonConfigStore implements IConfigStore {
  private readonly configPath: string;
  private readonly backupPath: string;
  private writeLock: Promise<unknown> = Promise.resolve();

  constructor(configDir: string = defaultConfigDir()) {
    this.configPath = path.join(configDir, "config.json");
    this.backupPath = path.join(configDir, "config.json.backup");
  }

  async loadConfig(): Promise<AgentConfig> {
    const fromPrimary = await this.tryRead(this.configPath);
    if (fromPrimary) return fromPrimary;

    const fromBackup = await this.tryRead(this.backupPath);
    if (fromBackup) {
      // Primary was missing or corrupted: restore it from the last known-good backup.
      await this.writeFile(this.configPath, fromBackup);
      return fromBackup;
    }

    const fresh = createDefaultConfig(defaultMachineName());
    await this.saveConfig(fresh);
    return fresh;
  }

  async saveConfig(config: AgentConfig): Promise<void> {
    const validated = AgentConfigSchema.parse(config);
    // Serialize writes so concurrent saveApp calls can't interleave and corrupt the file.
    this.writeLock = this.writeLock.then(() => this.persist(validated));
    await this.writeLock;
  }

  async loadApp(appId: string): Promise<App | null> {
    const config = await this.loadConfig();
    return config.apps.find((app) => app.id === appId) ?? null;
  }

  async saveApp(app: App): Promise<void> {
    const config = await this.loadConfig();
    const index = config.apps.findIndex((existing) => existing.id === app.id);
    const apps = [...config.apps];
    if (index >= 0) {
      apps[index] = app;
    } else {
      apps.push(app);
    }
    await this.saveConfig({ ...config, apps });
  }

  async deleteApp(appId: string): Promise<void> {
    const config = await this.loadConfig();
    await this.saveConfig({
      ...config,
      apps: config.apps.filter((app) => app.id !== appId),
    });
  }

  private async persist(config: AgentConfig): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });

    const existing = await this.tryReadRaw(this.configPath);
    if (existing) {
      await fs.writeFile(this.backupPath, existing, "utf-8");
    }
    await this.writeFile(this.configPath, config);
  }

  private async writeFile(filePath: string, config: AgentConfig): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
  }

  private async tryReadRaw(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  private async tryRead(filePath: string): Promise<AgentConfig | null> {
    const raw = await this.tryReadRaw(filePath);
    if (!raw) return null;
    try {
      return AgentConfigSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}

function defaultMachineName(): string {
  return process.env.COMPUTERNAME ?? os.hostname();
}
