import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import {
  ActionErrorCode,
  ExecutePayloadSchema,
  ProtocolError,
  type ExecutePayload,
} from "@stream-deck/shared";
import type { IConfigStore } from "../persistence/configStore";
import type { Logger } from "../../platform/logger";

export function createOpenAppHandler(configStore: IConfigStore, logger: Logger) {
  return async (rawPayload: unknown): Promise<void> => {
    const payload: ExecutePayload = ExecutePayloadSchema.parse(rawPayload);
    const app = await configStore.loadApp(payload.appId);

    if (!app) {
      throw new ProtocolError(
        ActionErrorCode.APPLICATION_NOT_FOUND,
        "O aplicativo configurado não foi encontrado.",
      );
    }

    const executablePath = app.action.path;

    try {
      await fs.access(executablePath);
    } catch {
      throw new ProtocolError(
        ActionErrorCode.APPLICATION_NOT_FOUND,
        "O aplicativo configurado não foi encontrado.",
        { appId: app.id },
      );
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(executablePath, [], { detached: true, stdio: "ignore" });

      child.once("error", (err) => {
        reject(
          new ProtocolError(
            ActionErrorCode.APPLICATION_LAUNCH_FAILED,
            "Não foi possível abrir o aplicativo. Verifique se o caminho ainda é válido.",
            { appId: app.id, cause: err.message },
          ),
        );
      });

      child.once("spawn", () => {
        logger.info(`Process started: PID ${child.pid} (${app.id})`);
        child.unref();
        resolve();
      });
    });
  };
}
