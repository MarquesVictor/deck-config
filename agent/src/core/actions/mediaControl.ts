import { ActionErrorCode, ProtocolError, type MediaCommand, type VolumeState } from "@stream-deck/shared";
import type { ActionRegistry } from "./index";
import { getMacVolume, runMacMediaCommand, setMacVolume } from "../../platform/macMedia";
import { getWindowsVolume, runWindowsMediaCommand, setWindowsVolume } from "../../platform/windowsMedia";

const MEDIA_COMMANDS: MediaCommand[] = [
  "volume_up",
  "volume_down",
  "volume_mute",
  "media_previous",
  "media_play_pause",
  "media_next",
  "mic_mute",
];

async function wrapPlatformError<T>(run: () => Promise<T>, context: Record<string, unknown>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ProtocolError) throw err;
    throw new ProtocolError(ActionErrorCode.INTERNAL_ERROR, "Não foi possível executar o comando de mídia.", {
      ...context,
      cause: err instanceof Error ? err.message : String(err),
    });
  }
}

function unsupportedPlatform(): never {
  throw new ProtocolError(ActionErrorCode.INTERNAL_ERROR, "Controles de mídia não são suportados nesta plataforma.");
}

/** Registers each MediaCommand as its own ActionRegistry action type, dispatched by platform. */
export function registerMediaControlActions(registry: ActionRegistry): void {
  for (const command of MEDIA_COMMANDS) {
    registry.register(command, () =>
      wrapPlatformError(async () => {
        if (process.platform === "darwin") await runMacMediaCommand(command);
        else if (process.platform === "win32") await runWindowsMediaCommand(command);
        else unsupportedPlatform();
      }, { command }),
    );
  }
}

export function getVolumeState(): Promise<VolumeState> {
  return wrapPlatformError(async () => {
    if (process.platform === "darwin") return getMacVolume();
    if (process.platform === "win32") return getWindowsVolume();
    unsupportedPlatform();
  }, { action: "get_volume" });
}

export function setVolumeLevel(volume: number): Promise<void> {
  return wrapPlatformError(async () => {
    if (process.platform === "darwin") return setMacVolume(volume);
    if (process.platform === "win32") return setWindowsVolume(volume);
    unsupportedPlatform();
  }, { action: "set_volume", volume });
}
