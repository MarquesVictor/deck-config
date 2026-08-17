import { useState } from "react";
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
import { AgentClient } from "../services/websocketClient";
import { generateAgentId, type SavedAgent } from "../services/storage";
import { colors } from "../theme";

const DEFAULT_PORT = "38421";

interface Props {
  onAdd: (agent: SavedAgent, client: AgentClient) => void;
}

export function AddComputerScreen({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(DEFAULT_PORT);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const client = new AgentClient();
    try {
      const info = await client.connect(trimmedHost, parsedPort);
      const savedAgent: SavedAgent = {
        id: generateAgentId(),
        name: name.trim() || info.name,
        host: trimmedHost,
        port: parsedPort,
      };
      onAdd(savedAgent, client);
      setName("");
      setHost("");
      setPort(DEFAULT_PORT);
    } catch {
      client.disconnect(); // cancel the background reconnect loop connect() started
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
      <Text style={styles.title}>Adicionar computador</Text>
      <Text style={styles.subtitle}>Ele aparece como uma nova página no carrossel</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Nome (opcional)</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Victor-PC"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.label}>Endereço IP</Text>
        <TextInput
          style={styles.input}
          value={host}
          onChangeText={setHost}
          placeholder="192.168.1.10"
          placeholderTextColor={colors.textFaint}
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
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, connecting && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.buttonText}>ADICIONAR</Text>
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
    backgroundColor: colors.bg,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 32,
  },
  form: {
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    marginTop: 12,
    fontSize: 13,
  },
  button: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: "center",
    marginTop: 32,
  },
});
