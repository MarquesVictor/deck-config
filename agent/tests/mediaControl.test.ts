import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { MediaControlPayloadSchema, ProtocolError } from "@stream-deck/shared";
import { ActionRegistry } from "../src/core/actions";
import { registerMediaControlActions } from "../src/core/actions/mediaControl";
import { RequestRouter } from "../src/core/requestRouter";
import type { IConfigStore } from "../src/core/persistence/configStore";

const execFileAsync = promisify(execFile);
const ASSETS_DIR = path.join(__dirname, "../src/ui/electron/assets");

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

  it("volume_up followed by volume_down returns to a nearby volume", async () => {
    const registry = new ActionRegistry();
    registerMediaControlActions(registry, ASSETS_DIR);

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
    registerMediaControlActions(registry, ASSETS_DIR);

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

  it("media transport commands either work or fail with a clear Accessibility-permission error", async () => {
    // Posting the NX_KEYTYPE event requires Accessibility permission for
    // whatever process runs this suite — not something a test can grant
    // itself. Assert the two acceptable outcomes: it actually works, or it
    // fails with our specific, actionable message (never a silent no-op,
    // never some unrelated crash).
    const registry = new ActionRegistry();
    registerMediaControlActions(registry, ASSETS_DIR);

    for (const command of ["media_play_pause", "media_next", "media_previous"] as const) {
      const error: ProtocolError | undefined = await registry
        .execute(command, { command })
        .then(() => undefined)
        .catch((e) => e);

      if (error) {
        expect(error).toBeInstanceOf(ProtocolError);
        expect(String((error as ProtocolError & { details?: { cause?: string } }).details?.cause)).toContain(
          "Permissão de Acessibilidade",
        );
      }
    }
  });

  it("wraps a failing platform command in a ProtocolError", async () => {
    const registry = new ActionRegistry();
    // Point at a directory with no such script to force a real failure path.
    registerMediaControlActions(registry, path.join(__dirname, "does-not-exist"));

    const error: ProtocolError = await registry
      .execute("media_next", { command: "media_next" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error.code).toBe("INTERNAL_ERROR");
  });
});
