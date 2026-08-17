import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import type { MediaCommand, VolumeState } from "@stream-deck/shared";
import type { AgentClient } from "../services/websocketClient";
import { colors } from "../theme";

interface TransportSpec {
  command: MediaCommand;
  icon: string;
  label: string;
}

const TRANSPORT_BUTTONS: TransportSpec[] = [
  { command: "media_previous", icon: "⏮", label: "Anterior" },
  { command: "media_play_pause", icon: "⏯", label: "Play/Pause" },
  { command: "media_next", icon: "⏭", label: "Próxima" },
];

interface Props {
  client: AgentClient;
  disabled: boolean;
}

export function MediaBar({ client, disabled }: Props) {
  const [erroredCommand, setErroredCommand] = useState<MediaCommand | null>(null);
  const [volumeState, setVolumeState] = useState<VolumeState | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [micMuted, setMicMuted] = useState(false);

  const flashError = (command: MediaCommand) => {
    setErroredCommand(command);
    setTimeout(() => setErroredCommand((current) => (current === command ? null : current)), 900);
  };

  const refreshVolume = useCallback(async () => {
    try {
      const state = await client.request<VolumeState>("get_volume");
      setVolumeState(state);
    } catch {
      // Leaves the last-known slider position in place rather than resetting it to a guess.
    }
  }, [client]);

  useEffect(() => {
    if (!disabled) refreshVolume();
  }, [disabled, refreshVolume]);

  const pressTransport = async (command: MediaCommand) => {
    if (disabled) return;
    try {
      await client.request("media_control", { command });
    } catch {
      flashError(command);
    }
  };

  const pressMute = async () => {
    if (disabled) return;
    try {
      await client.request("media_control", { command: "volume_mute" });
      await refreshVolume();
    } catch {
      flashError("volume_mute");
    }
  };

  const pressMic = async () => {
    if (disabled) return;
    try {
      await client.request("media_control", { command: "mic_mute" });
      setMicMuted((v) => !v);
    } catch {
      flashError("mic_mute");
    }
  };

  const handleSlideComplete = async (value: number) => {
    setDragValue(null);
    if (disabled) return;
    try {
      await client.request("set_volume", { volume: Math.round(value) });
      setVolumeState((prev) => (prev ? { ...prev, volume: Math.round(value) } : prev));
    } catch {
      flashError("volume_up");
      refreshVolume();
    }
  };

  const shownVolume = dragValue ?? volumeState?.volume ?? 0;
  const volumeIcon = volumeState?.muted ? "🔇" : shownVolume === 0 ? "🔈" : shownVolume < 60 ? "🔉" : "🔊";

  return (
    <View style={[styles.bar, disabled && styles.barDisabled]}>
      <View style={styles.transportRow}>
        {TRANSPORT_BUTTONS.map((btn) => (
          <TouchableOpacity
            key={btn.command}
            style={styles.transportButton}
            onPress={() => pressTransport(btn.command)}
            accessibilityLabel={btn.label}
          >
            <Text style={[styles.transportIcon, erroredCommand === btn.command && styles.iconError]}>
              {btn.icon}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.volumeRow}>
        <TouchableOpacity onPress={pressMute} accessibilityLabel="Mudo" style={styles.volumeIconButton}>
          <Text style={[styles.volumeIcon, erroredCommand === "volume_mute" && styles.iconError]}>
            {volumeIcon}
          </Text>
        </TouchableOpacity>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={shownVolume}
          disabled={disabled}
          onValueChange={setDragValue}
          onSlidingComplete={handleSlideComplete}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.accent}
        />
        <TouchableOpacity onPress={pressMic} accessibilityLabel="Microfone" style={styles.micButton}>
          <Text style={[styles.micIcon, erroredCommand === "mic_mute" && styles.iconError]}>
            {micMuted ? "🔇" : "🎙️"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  barDisabled: {
    opacity: 0.35,
  },
  transportRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 22,
    marginBottom: 4,
  },
  transportButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  transportIcon: {
    fontSize: 20,
    color: colors.text,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  volumeIconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  volumeIcon: {
    fontSize: 18,
  },
  slider: {
    flex: 1,
    height: 32,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  micIcon: {
    fontSize: 16,
  },
  iconError: {
    opacity: 0.35,
  },
});
