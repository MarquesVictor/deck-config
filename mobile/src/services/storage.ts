import AsyncStorage from "@react-native-async-storage/async-storage";

const SAVED_AGENTS_KEY = "streamdeck:savedAgents";

export interface SavedAgent {
  /** Locally generated id — stable across renames, independent of the Agent's own machineId. */
  id: string;
  name: string;
  host: string;
  port: number;
  /** User intentionally disconnected this one (e.g. it's turned off) — don't auto-connect/reconnect until resumed. */
  paused?: boolean;
}

export async function loadSavedAgents(): Promise<SavedAgent[]> {
  const raw = await AsyncStorage.getItem(SAVED_AGENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSavedAgents(agents: SavedAgent[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_AGENTS_KEY, JSON.stringify(agents));
}

export function generateAgentId(): string {
  return `saved_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
