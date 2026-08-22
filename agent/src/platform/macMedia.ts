import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MediaCommand, VolumeState } from "@stream-deck/shared";

const execFileAsync = promisify(execFile);
const VOLUME_STEP = 10;

const MEDIA_APPS = ["Spotify", "Music"] as const;
type MediaApp = (typeof MEDIA_APPS)[number];

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", script]);
  return stdout.trim();
}

async function isRunning(appName: string): Promise<boolean> {
  const result = await runAppleScript(
    `tell application "System Events" to (name of processes) contains "${appName}"`,
  );
  return result === "true";
}

/**
 * Earlier attempt simulated the raw hardware media-key HID event
 * (NSEvent/CGEventPost with NX_KEYTYPE_PLAY etc.) — the same technique many
 * older third-party menu-bar utilities used. It didn't work on this
 * machine even with Accessibility permission granted and correct syntax
 * (verified: even NX_KEYTYPE_SOUND_UP posted through the identical code
 * path produced no volume change), which points at macOS having tightened
 * synthetic system-defined event delivery in recent versions rather than a
 * one-off bug. Targeting the app directly via its own scripting dictionary
 * — the officially supported mechanism — is what's actually reliable;
 * confirmed against a real, playing Spotify instance (track changed,
 * play/pause state changed, and back again). Trade-off: only Spotify and
 * Music are supported, not "whatever currently has media focus".
 */
async function detectMediaApp(): Promise<MediaApp | null> {
  for (const app of MEDIA_APPS) {
    if (await isRunning(app)) return app;
  }
  return null;
}

async function runMediaTransportCommand(
  command: "playpause" | "next track" | "previous track",
): Promise<void> {
  const app = await detectMediaApp();
  if (!app) {
    throw new Error("Nenhum app de música compatível (Spotify ou Music) está aberto.");
  }
  await runAppleScript(`tell application "${app}" to ${command}`);
}

/**
 * macOS has no single "mute" flag for the system input device the way it
 * does for output (`output muted`) — `get volume settings` only exposes a
 * numeric `input volume`. Mic mute is approximated as a hard toggle between
 * 0 and full (100), not a restore-to-previous-level: muting from a partial
 * level and unmuting lands at 100%, not back at the original level.
 */
export async function runMacMediaCommand(command: MediaCommand): Promise<void> {
  switch (command) {
    case "volume_up":
      await runAppleScript(`
        set curVol to output volume of (get volume settings)
        set newVol to curVol + ${VOLUME_STEP}
        if newVol > 100 then set newVol to 100
        set volume output volume newVol
      `);
      return;

    case "volume_down":
      await runAppleScript(`
        set curVol to output volume of (get volume settings)
        set newVol to curVol - ${VOLUME_STEP}
        if newVol < 0 then set newVol to 0
        set volume output volume newVol
      `);
      return;

    case "volume_mute":
      await runAppleScript(`
        set isMuted to output muted of (get volume settings)
        set volume output muted (not isMuted)
      `);
      return;

    case "mic_mute":
      await runAppleScript(`
        set curVol to input volume of (get volume settings)
        if curVol > 0 then
          set volume input volume 0
        else
          set volume input volume 100
        end if
      `);
      return;

    case "media_previous":
      await runMediaTransportCommand("previous track");
      return;

    case "media_play_pause":
      await runMediaTransportCommand("playpause");
      return;

    case "media_next":
      await runMediaTransportCommand("next track");
      return;
  }
}

export async function getMacVolume(): Promise<VolumeState> {
  const [volumeStr, mutedStr] = await Promise.all([
    runAppleScript("output volume of (get volume settings)"),
    runAppleScript("output muted of (get volume settings)"),
  ]);
  return { volume: Number(volumeStr), muted: mutedStr === "true" };
}

export async function setMacVolume(volume: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  await runAppleScript(`set volume output volume ${clamped}`);
}
