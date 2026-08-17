import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { AddComputerScreen } from "./src/screens/AddComputerScreen";
import { ControlScreen } from "./src/screens/ControlScreen";
import { PageDots } from "./src/components/PageDots";
import { AgentClient, type ConnectionStatus } from "./src/services/websocketClient";
import { loadSavedAgents, saveSavedAgents, type SavedAgent } from "./src/services/storage";
import { colors, statusDotColor } from "./src/theme";

const ADD_PAGE_ID = "__add__";
type Page = SavedAgent | { id: typeof ADD_PAGE_ID };

interface ClientEntry {
  client: AgentClient;
  unsubscribe: () => void;
}

export default function App() {
  const { width } = useWindowDimensions();
  const [loaded, setLoaded] = useState(false);
  const [savedAgents, setSavedAgents] = useState<SavedAgent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [renameTarget, setRenameTarget] = useState<SavedAgent | null>(null);
  const [renameText, setRenameText] = useState("");
  const clientsRef = useRef<Map<string, ClientEntry>>(new Map());

  const registerClient = useCallback((agent: SavedAgent, client: AgentClient) => {
    const unsubscribe = client.onStatusChange((status) => {
      setStatuses((prev) => ({ ...prev, [agent.id]: status }));
    });
    clientsRef.current.set(agent.id, { client, unsubscribe });
    setStatuses((prev) => ({ ...prev, [agent.id]: client.getStatus() }));
  }, []);

  // Load saved computers once, then open (and keep open) a connection to
  // every one of them in the background — that's what makes swiping
  // between pages instant instead of showing a spinner each time.
  useEffect(() => {
    loadSavedAgents().then((agents) => {
      setSavedAgents(agents);
      for (const agent of agents) {
        const client = new AgentClient();
        registerClient(agent, client);
        if (!agent.paused) client.connect(agent.host, agent.port).catch(() => {});
      }
      setLoaded(true);
    });
  }, [registerClient]);

  const persist = (agents: SavedAgent[]) => {
    setSavedAgents(agents);
    saveSavedAgents(agents);
  };

  const handleAdd = (agent: SavedAgent, client: AgentClient) => {
    registerClient(agent, client);
    persist([...savedAgents, agent]);
  };

  const removeAgent = (agent: SavedAgent) => {
    const entry = clientsRef.current.get(agent.id);
    entry?.unsubscribe();
    entry?.client.disconnect();
    clientsRef.current.delete(agent.id);
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[agent.id];
      return next;
    });
    persist(savedAgents.filter((a) => a.id !== agent.id));
  };

  const renameAgent = (agent: SavedAgent, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    persist(savedAgents.map((a) => (a.id === agent.id ? { ...a, name: trimmed } : a)));
  };

  /** Disconnects/reconnects without touching the saved list — e.g. the computer is off for a while. */
  const togglePause = (agent: SavedAgent) => {
    const nextPaused = !agent.paused;
    const entry = clientsRef.current.get(agent.id);
    if (nextPaused) {
      entry?.client.disconnect();
    } else {
      entry?.client.connect(agent.host, agent.port).catch(() => {});
    }
    persist(savedAgents.map((a) => (a.id === agent.id ? { ...a, paused: nextPaused } : a)));
  };

  const handleLongPress = (agent: SavedAgent) => {
    Alert.alert(agent.name, undefined, [
      {
        text: agent.paused ? "Reconectar" : "Desconectar",
        onPress: () => togglePause(agent),
      },
      {
        text: "Renomear",
        onPress: () => {
          setRenameText(agent.name);
          setRenameTarget(agent);
        },
      },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          Alert.alert("Remover computador?", `"${agent.name}" será removido da lista.`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Remover", style: "destructive", onPress: () => removeAgent(agent) },
          ]);
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  if (!loaded) {
    return <View style={styles.container} />;
  }

  const pages: Page[] = [...savedAgents, { id: ADD_PAGE_ID }];
  const dotColors = savedAgents.map((a) => (a.paused ? colors.textFaint : statusDotColor(statuses[a.id] ?? "connecting")));

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.pager}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item }) => (
          <View style={{ width }}>
            {item.id === ADD_PAGE_ID ? (
              <AddComputerScreen onAdd={handleAdd} />
            ) : (
              <PageForAgent
                agent={item as SavedAgent}
                clientsRef={clientsRef}
                onLongPressHeader={() => handleLongPress(item as SavedAgent)}
              />
            )}
          </View>
        )}
      />

      <PageDots dotColors={dotColors} activeIndex={activeIndex} onAddPage={activeIndex === pages.length - 1} />

      <Modal visible={renameTarget !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Renomear computador</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              placeholderTextColor={colors.textFaint}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setRenameTarget(null)}>
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => {
                  if (renameTarget) renameAgent(renameTarget, renameText);
                  setRenameTarget(null);
                }}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <StatusBar style="light" />
    </View>
  );
}

/** Looks up the (already-connecting-in-the-background) client for this saved agent. */
function PageForAgent({
  agent,
  clientsRef,
  onLongPressHeader,
}: {
  agent: SavedAgent;
  clientsRef: RefObject<Map<string, ClientEntry>>;
  onLongPressHeader: () => void;
}) {
  const entry = clientsRef.current.get(agent.id);
  if (!entry) return <View style={styles.container} />; // one-frame gap before the initial effect registers clients

  return (
    <ControlScreen
      client={entry.client}
      displayName={agent.name}
      paused={agent.paused}
      onLongPressHeader={onLongPressHeader}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pager: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  modalInput: {
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalBtnPrimary: {
    backgroundColor: colors.accent,
  },
  modalBtnText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13.5,
  },
  modalBtnTextPrimary: {
    color: colors.text,
  },
});
