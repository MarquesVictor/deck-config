import { z } from "zod";
import { AppSchema } from "@stream-deck/shared";

export const AgentIdentitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string(),
});
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

export const AgentSettingsSchema = z.object({
  autoStartWindows: z.boolean(),
  startMinimized: z.boolean(),
  showInTray: z.boolean().default(true),
  logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
});
export type AgentSettings = z.infer<typeof AgentSettingsSchema>;

export const AgentConfigSchema = z.object({
  version: z.literal(1),
  machine: AgentIdentitySchema,
  apps: z.array(AppSchema),
  settings: AgentSettingsSchema,
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export function createDefaultConfig(machineName: string): AgentConfig {
  const uuid = crypto.randomUUID();
  return {
    version: 1,
    machine: {
      id: `machine_${uuid.split("-")[0]}`,
      name: machineName,
      createdAt: new Date().toISOString(),
    },
    apps: [],
    settings: {
      autoStartWindows: true,
      startMinimized: true,
      showInTray: true,
      logLevel: "info",
    },
  };
}
