import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { iconFor, type AppSummary } from "@stream-deck/shared";
import type { AgentClient, ConnectionStatus } from "../services/websocketClient";
import { colors, statusDotColor } from "../theme";

type ButtonState = "idle" | "loading" | "success" | "error";

interface Props {
  client: AgentClient;
  /** Locally saved label for this computer — shown immediately, independent of handshake state. */
  displayName: string;
  /** User intentionally disconnected this one — shows "Pausado" instead of the generic disconnected label. */
  paused?: boolean;
  /** Long-press on the header opens rename/remove for this computer. */
  onLongPressHeader?: () => void;
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: "Conectado",
  connecting: "Conectando...",
  reconnecting: "Reconectando...",
  failed: "Desconectado",
  disconnected: "Desconectado",
};

export function ControlScreen({ client, displayName, paused, onLongPressHeader }: Props) {
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
      <Pressable style={styles.header} onLongPress={onLongPressHeader} delayLongPress={400}>
        <View style={styles.headerInfo}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.statusDot, { backgroundColor: paused ? colors.textFaint : statusDotColor(status) }]} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          <Text style={styles.headerSubtitle}>{paused ? "Pausado" : STATUS_LABELS[status]}</Text>
        </View>
      </Pressable>

      {status === "reconnecting" && <Text style={styles.banner}>Reconectando...</Text>}
      {status === "failed" && (
        <View style={styles.bannerRow}>
          <Text style={[styles.banner, styles.bannerError]}>Não foi possível reconectar.</Text>
          <TouchableOpacity onPress={() => client.retry()}>
            <Text style={styles.retryLink}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {loadingApps ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
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
        <ActivityIndicator color={colors.text} />
      ) : state === "success" ? (
        <Text style={styles.buttonIcon}>✅</Text>
      ) : state === "error" ? (
        <Text style={styles.buttonIcon}>❌</Text>
      ) : app.iconImage ? (
        <Image source={{ uri: app.iconImage }} style={styles.buttonIconImage} />
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
    backgroundColor: colors.bg,
    paddingTop: 56,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    flexShrink: 1,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 12.5,
    marginTop: 3,
    marginLeft: 16,
  },
  banner: {
    textAlign: "center",
    color: colors.warning,
    paddingVertical: 8,
    fontSize: 13,
  },
  bannerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  bannerError: {
    color: colors.danger,
  },
  retryLink: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 13,
  },
  loading: {
    marginTop: 40,
  },
  empty: {
    color: colors.textFaint,
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
    backgroundColor: colors.surface,
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
  buttonIconImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 6,
  },
});
