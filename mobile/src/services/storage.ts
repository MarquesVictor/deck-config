import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_CONNECTION_KEY = "streamdeck:lastConnection";

export interface LastConnection {
  host: string;
  port: number;
}

export async function saveLastConnection(connection: LastConnection): Promise<void> {
  await AsyncStorage.setItem(LAST_CONNECTION_KEY, JSON.stringify(connection));
}

export async function loadLastConnection(): Promise<LastConnection | null> {
  const raw = await AsyncStorage.getItem(LAST_CONNECTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastConnection;
  } catch {
    return null;
  }
}
