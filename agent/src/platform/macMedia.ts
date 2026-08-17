import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { MediaCommand } from "@stream-deck/shared";

const execFileAsync = promisify(execFile);
const VOLUME_STEP = 10;

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", script]);
  return stdout.trim();
}

async function runMediaKey(assetsDir: string, key: "previous" | "play_pause" | "next"): Promise<void> {
  const script = path.join(assetsDir, "simulate-mac-media-key.jxa.js");
  await execFileAsync("/usr/bin/osascript", ["-l", "JavaScript", script, key]);
}

/**
 * macOS has no single "mute" flag for the system input device the way it
 * does for output (`output muted`) — `get volume settings` only exposes a
 * numeric `input volume`. Mic mute is approximated as a hard toggle between
 * 0 and full (100), not a restore-to-previous-level: muting from a partial
 * level and unmuting lands at 100%, not back at the original level.
 */
export async function runMacMediaCommand(command: MediaCommand, assetsDir: string): Promise<void> {
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
      await runMediaKey(assetsDir, "previous");
      return;

    case "media_play_pause":
      await runMediaKey(assetsDir, "play_pause");
      return;

    case "media_next":
      await runMediaKey(assetsDir, "next");
      return;
  }
}
