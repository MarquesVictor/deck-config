import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { MediaCommand } from "@stream-deck/shared";
import type { AgentClient } from "../services/websocketClient";
import { colors } from "../theme";

interface ButtonSpec {
  command: MediaCommand;
  icon: string;
  label: string;
}

const TRANSPORT_BUTTONS: ButtonSpec[] = [
  { command: "media_previous", icon: "⏮", label: "Anterior" },
  { command: "media_play_pause", icon: "⏯", label: "Play/Pause" },
  { command: "media_next", icon: "⏭", label: "Próxima" },
];

const VOLUME_BUTTONS: ButtonSpec[] = [
  { command: "volume_down", icon: "🔉", label: "Diminuir volume" },
  { command: "volume_mute", icon: "🔇", label: "Mudo" },
  { command: "volume_up", icon: "🔊", label: "Aumentar volume" },
];

const MIC_BUTTON: ButtonSpec = { command: "mic_mute", icon: "🎙️", label: "Microfone" };

interface Props {
  client: AgentClient;
  disabled: boolean;
}

export function MediaBar({ client, disabled }: Props) {
  const [erroredCommand, setErroredCommand] = useState<MediaCommand | null>(null);

  const press = async (command: MediaCommand) => {
    if (disabled) return;
    try {
      await client.request("media_control", { command });
    } catch {
      setErroredCommand(command);
      setTimeout(() => setErroredCommand((current) => (current === command ? null : current)), 900);
    }
  };

  return (
    <View style={[styles.bar, disabled && styles.barDisabled]}>
      <Group buttons={TRANSPORT_BUTTONS} onPress={press} erroredCommand={erroredCommand} />
      <View style={styles.divider} />
      <Group buttons={VOLUME_BUTTONS} onPress={press} erroredCommand={erroredCommand} />
      <View style={styles.divider} />
      <Group buttons={[MIC_BUTTON]} onPress={press} erroredCommand={erroredCommand} />
    </View>
  );
}

function Group({
  buttons,
  onPress,
  erroredCommand,
}: {
  buttons: ButtonSpec[];
  onPress: (command: MediaCommand) => void;
  erroredCommand: MediaCommand | null;
}) {
  return (
    <View style={styles.group}>
      {buttons.map((btn) => (
        <TouchableOpacity
          key={btn.command}
          style={styles.button}
          onPress={() => onPress(btn.command)}
          accessibilityLabel={btn.label}
        >
          <Text style={[styles.icon, erroredCommand === btn.command && styles.iconError]}>{btn.icon}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
  },
  barDisabled: {
    opacity: 0.35,
  },
  group: {
    flexDirection: "row",
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
  },
  button: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 19,
  },
  iconError: {
    opacity: 0.4,
  },
});
