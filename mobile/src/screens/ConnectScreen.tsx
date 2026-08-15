import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { AgentClient, AgentInfo } from "../services/websocketClient";
import { loadLastConnection, saveLastConnection } from "../services/storage";

const DEFAULT_PORT = "38421";

interface Props {
  client: AgentClient;
  onConnected: (agent: AgentInfo, host: string, port: number) => void;
}

export function ConnectScreen({ client, onConnected }: Props) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(DEFAULT_PORT);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLastConnection().then((last) => {
      if (last) {
        setHost(last.host);
        setPort(String(last.port));
      }
    });
  }, []);

  const handleConnect = async () => {
    const trimmedHost = host.trim();
    const parsedPort = Number(port);

    if (!trimmedHost) {
      setError("Informe o endereço IP do computador.");
      return;
    }
    if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      setError("Porta inválida.");
      return;
    }

    setError(null);
    setConnecting(true);
    try {
      const agent = await client.connect(trimmedHost, parsedPort);
      await saveLastConnection({ host: trimmedHost, port: parsedPort });
      onConnected(agent, trimmedHost, parsedPort);
    } catch {
      setError(
        "Não foi possível conectar. Verifique se o Stream Deck Agent está aberto e se o celular está na mesma rede Wi-Fi.",
      );
    } finally {
      setConnecting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Stream Deck</Text>
      <Text style={styles.subtitle}>Conectar a um computador</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Endereço IP</Text>
        <TextInput
          style={styles.input}
          value={host}
          onChangeText={setHost}
          placeholder="192.168.1.10"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>Porta</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          placeholder={DEFAULT_PORT}
          placeholderTextColor="#888"
          keyboardType="number-pad"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, connecting && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>CONECTAR</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        O IP do computador aparece na tela do Stream Deck Agent, em Configurações → Rede.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111318",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#9aa0a6",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 32,
  },
  form: {
    gap: 8,
  },
  label: {
    color: "#9aa0a6",
    fontSize: 13,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#1c1f26",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: "#ff6b6b",
    marginTop: 12,
    fontSize: 13,
  },
  button: {
    marginTop: 24,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  hint: {
    color: "#5f6368",
    fontSize: 12,
    textAlign: "center",
    marginTop: 32,
  },
});
