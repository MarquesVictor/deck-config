import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { iconFor, type AppSummary } from "@stream-deck/shared";
import type { AgentClient, AgentInfo, ConnectionStatus } from "../services/websocketClient";

type ButtonState = "idle" | "loading" | "success" | "error";

interface Props {
  client: AgentClient;
  agent: AgentInfo;
  onDisconnect: () => void;
}

export function ControlScreen({ client, agent, onDisconnect }: Props) {
  const { width, height } = useWindowDimensions();
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>(client.getStatus());
  const [buttonStates, setButtonStates] = useState<Record<string, ButtonState>>({});

  const columns = width > height ? (width > 900 ? 6 : 4) : width > 600 ? 4 : 2;

  const fetchApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const data = await client.request<{ apps: AppSummary[] }>("get_apps");
      setApps([...data.apps].sort((a, b) => a.position - b.position));
    } catch {
      // Connection banner already reflects the underlying problem; nothing extra to show here.
    } finally {
      setLoadingApps(false);
    }
  }, [client]);

  useEffect(() => {
    fetchApps();
    const unsubscribeStatus = client.onStatusChange((next) => {
      setStatus(next);
      if (next === "connected") fetchApps();
    });
    const unsubscribeApps = client.onAppsUpdated((next) => {
      setApps([...next].sort((a, b) => a.position - b.position));
    });
    return () => {
      unsubscribeStatus();
      unsubscribeApps();
    };
  }, [client, fetchApps]);

  const handlePress = async (app: AppSummary) => {
    if (status !== "connected") return;
    setButtonStates((prev) => ({ ...prev, [app.id]: "loading" }));
    try {
      await client.request("execute", { appId: app.id });
      setButtonStates((prev) => ({ ...prev, [app.id]: "success" }));
    } catch {
      setButtonStates((prev) => ({ ...prev, [app.id]: "error" }));
    } finally {
      setTimeout(() => {
        setButtonStates((prev) => ({ ...prev, [app.id]: "idle" }));
      }, 1200);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{agent.name}</Text>
        <StatusBadge status={status} />
        <TouchableOpacity onPress={onDisconnect}>
          <Text style={styles.disconnect}>Desconectar</Text>
        </TouchableOpacity>
      </View>

      {status === "reconnecting" && (
        <Text style={styles.banner}>🟡 Reconectando...</Text>
      )}
      {status === "failed" && (
        <View style={styles.bannerRow}>
          <Text style={[styles.banner, styles.bannerError]}>Não foi possível reconectar.</Text>
          <TouchableOpacity onPress={() => client.retry()}>
            <Text style={styles.retryLink}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {loadingApps ? (
        <ActivityIndicator style={styles.loading} color="#3b82f6" />
      ) : apps.length === 0 ? (
        <Text style={styles.empty}>
          Nenhum aplicativo configurado ainda.{"\n"}Adicione um pelo Stream Deck Agent no computador.
        </Text>
      ) : (
        <FlatList
          key={columns}
          data={apps}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <AppButton
              app={item}
              state={buttonStates[item.id] ?? "idle"}
              disabled={status !== "connected"}
              onPress={() => handlePress(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const label = status === "connected" ? "🟢 Conectado" : status === "reconnecting" ? "🟡 Reconectando" : status === "failed" ? "🔴 Desconectado" : "⚪ Conectando";
  return <Text style={styles.statusBadge}>{label}</Text>;
}

function AppButton({
  app,
  state,
  disabled,
  onPress,
}: {
  app: AppSummary;
  state: ButtonState;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || state === "loading"}
    >
      {state === "loading" ? (
        <ActivityIndicator color="#fff" />
      ) : state === "success" ? (
        <Text style={styles.buttonIcon}>✅</Text>
      ) : state === "error" ? (
        <Text style={styles.buttonIcon}>❌</Text>
      ) : (
        <Text style={styles.buttonIcon}>{iconFor(app.icon)}</Text>
      )}
      <Text style={styles.buttonLabel} numberOfLines={1}>
        {app.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111318",
    paddingTop: 56,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    color: "#9aa0a6",
    fontSize: 12,
  },
  disconnect: {
    color: "#ff6b6b",
    fontSize: 13,
  },
  banner: {
    textAlign: "center",
    color: "#facc15",
    paddingVertical: 8,
  },
  bannerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  bannerError: {
    color: "#ff6b6b",
  },
  retryLink: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  loading: {
    marginTop: 40,
  },
  empty: {
    color: "#5f6368",
    textAlign: "center",
    marginTop: 60,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  grid: {
    padding: 12,
  },
  button: {
    flex: 1,
    aspectRatio: 1,
    margin: 8,
    backgroundColor: "#1c1f26",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonIcon: {
    fontSize: 32,
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 13,
    paddingHorizontal: 6,
  },
});
