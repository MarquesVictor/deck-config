import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { MediaControlPayloadSchema, ProtocolError } from "@stream-deck/shared";
import { ActionRegistry } from "../src/core/actions";
import { registerMediaControlActions } from "../src/core/actions/mediaControl";
import { RequestRouter } from "../src/core/requestRouter";
import type { IConfigStore } from "../src/core/persistence/configStore";

const execFileAsync = promisify(execFile);

// RequestRouter needs a configStore, but media_control never touches it.
const unusedConfigStore = {} as IConfigStore;

describe("media_control protocol wiring", () => {
  it("dispatches the payload's command as the action type, with no appId lookup", async () => {
    const registry = new ActionRegistry();
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register("volume_up", handler);
    const router = new RequestRouter(unusedConfigStore, registry);

    await router.handle({
      protocolVersion: 1,
      type: "request",
      requestId: "req_1",
      machineId: "machine_x",
      action: "media_control",
      payload: { command: "volume_up" },
    });

    expect(handler).toHaveBeenCalledWith({ command: "volume_up" });
  });

  it("rejects a command outside the known MediaCommand set", () => {
    expect(() => MediaControlPayloadSchema.parse({ command: "not_a_real_command" })).toThrow();
  });

  it("surfaces INVALID_ACTION for a well-formed command with no registered handler", async () => {
    const registry = new ActionRegistry(); // nothing registered
    const router = new RequestRouter(unusedConfigStore, registry);

    await expect(
      router.handle({
        protocolVersion: 1,
        type: "request",
        requestId: "req_2",
        machineId: "machine_x",
        action: "media_control",
        payload: { command: "mic_mute" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_ACTION" });
  });
});

describe.runIf(process.platform === "darwin")("media_control on macOS (real system effect)", () => {
  async function getOutputVolume(): Promise<number> {
    const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", "output volume of (get volume settings)"]);
    return Number(stdout.trim());
  }

  async function isAppRunning(appName: string): Promise<boolean> {
    const { stdout } = await execFileAsync("/usr/bin/osascript", [
      "-e",
      `tell application "System Events" to (name of processes) contains "${appName}"`,
    ]);
    return stdout.trim() === "true";
  }

  it("volume_up followed by volume_down returns to a nearby volume", async () => {
    const registry = new ActionRegistry();
    registerMediaControlActions(registry);

    const before = await getOutputVolume();
    await registry.execute("volume_up", { command: "volume_up" });
    const afterUp = await getOutputVolume();
    await registry.execute("volume_down", { command: "volume_down" });
    const afterDown = await getOutputVolume();

    expect(afterUp).toBeGreaterThan(before === 100 ? before - 1 : before);
    expect(Math.abs(afterDown - before)).toBeLessThanOrEqual(1);
  });

  it("volume_mute toggles output muted and back", async () => {
    const registry = new ActionRegistry();
    registerMediaControlActions(registry);

    const getMuted = async () => {
      const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", "output muted of (get volume settings)"]);
      return stdout.trim() === "true";
    };

    const before = await getMuted();
    await registry.execute("volume_mute", { command: "volume_mute" });
    expect(await getMuted()).toBe(!before);
    await registry.execute("volume_mute", { command: "volume_mute" }); // restore
    expect(await getMuted()).toBe(before);
  });

  it("media transport targets Spotify/Music when one is running, else gives a clear error", async () => {
    const registry = new ActionRegistry();
    registerMediaControlActions(registry);

    const playerRunning = (await isAppRunning("Spotify")) || (await isAppRunning("Music"));

    if (!playerRunning) {
      const error: ProtocolError = await registry
        .execute("media_play_pause", { command: "media_play_pause" })
        .catch((e) => e);
      expect(error).toBeInstanceOf(ProtocolError);
      expect(String((error as ProtocolError & { details?: { cause?: string } }).details?.cause)).toContain(
        "Nenhum app de música",
      );
      return;
    }

    // A real player is running: playpause should actually toggle its state
    // (verified manually against a live Spotify instance — track and
    // play/pause state genuinely changed and back). Toggle twice here to
    // leave the user's playback state as found.
    await expect(registry.execute("media_play_pause", { command: "media_play_pause" })).resolves.toBeUndefined();
    await registry.execute("media_play_pause", { command: "media_play_pause" });

    await expect(registry.execute("media_next", { command: "media_next" })).resolves.toBeUndefined();
    await expect(registry.execute("media_previous", { command: "media_previous" })).resolves.toBeUndefined();
  });
});
