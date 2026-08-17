import { ActionErrorCode, ProtocolError, type MediaCommand } from "@stream-deck/shared";
import type { ActionRegistry } from "./index";
import { runMacMediaCommand } from "../../platform/macMedia";
import { runWindowsMediaCommand } from "../../platform/windowsMedia";

const MEDIA_COMMANDS: MediaCommand[] = [
  "volume_up",
  "volume_down",
  "volume_mute",
  "media_previous",
  "media_play_pause",
  "media_next",
  "mic_mute",
];

/** Registers each MediaCommand as its own ActionRegistry action type, dispatched by platform. */
export function registerMediaControlActions(registry: ActionRegistry): void {
  for (const command of MEDIA_COMMANDS) {
    registry.register(command, async () => {
      try {
        if (process.platform === "darwin") {
          await runMacMediaCommand(command);
        } else if (process.platform === "win32") {
          await runWindowsMediaCommand(command);
        } else {
          throw new ProtocolError(
            ActionErrorCode.INTERNAL_ERROR,
            "Controles de mídia não são suportados nesta plataforma.",
          );
        }
      } catch (err) {
        if (err instanceof ProtocolError) throw err;
        throw new ProtocolError(
          ActionErrorCode.INTERNAL_ERROR,
          "Não foi possível executar o comando de mídia.",
          { command, cause: err instanceof Error ? err.message : String(err) },
        );
      }
    });
  }
}
