import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractMacAppIcon } from "../src/platform/macIcon";

const ASSETS_DIR = path.join(__dirname, "../src/ui/electron/assets");
// Guaranteed to exist on any macOS install, so this doesn't depend on
// whatever apps happen to be installed on the machine running the suite.
const CALCULATOR_APP = "/System/Applications/Calculator.app";

describe.runIf(process.platform === "darwin")("extractMacAppIcon", () => {
  it("extracts a real PNG data URL for a known .app bundle", async () => {
    const result = await extractMacAppIcon(CALCULATOR_APP, ASSETS_DIR);

    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png;base64,/);

    const base64 = result!.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    // A real icon at 64px lands in the multi-KB range; Electron's buggy
    // generic-icon fallback this replaces is under 2KB — this threshold
    // catches a regression back to that behavior.
    expect(buffer.byteLength).toBeGreaterThan(2000);

    // PNG magic bytes.
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("returns null for a path that doesn't exist", async () => {
    const result = await extractMacAppIcon("/Applications/DoesNotExist.app", ASSETS_DIR);
    expect(result).toBeNull();
  });
});
