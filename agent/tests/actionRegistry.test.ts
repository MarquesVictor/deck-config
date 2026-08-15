import { describe, expect, it, vi } from "vitest";
import { ProtocolError } from "@stream-deck/shared";
import { ActionRegistry } from "../src/core/actions";

describe("ActionRegistry", () => {
  it("executes a registered action", async () => {
    const registry = new ActionRegistry();
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register("test", handler);

    await registry.execute("test", { foo: "bar" });

    expect(handler).toHaveBeenCalledWith({ foo: "bar" });
  });

  it("rejects unknown actions with INVALID_ACTION", async () => {
    const registry = new ActionRegistry();

    await expect(registry.execute("unknown", {})).rejects.toMatchObject({
      code: "INVALID_ACTION",
    });
    await expect(registry.execute("unknown", {})).rejects.toBeInstanceOf(ProtocolError);
  });
});
