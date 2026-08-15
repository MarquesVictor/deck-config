import {
  ActionErrorCode,
  ExecutePayloadSchema,
  ProtocolError,
  toAppSummary,
  type RequestMessage,
} from "@stream-deck/shared";
import type { IConfigStore } from "./persistence/configStore";
import type { ActionRegistry } from "./actions";

/** Routes a validated, authenticated request to the right handler and returns response data. */
export class RequestRouter {
  constructor(
    private readonly configStore: IConfigStore,
    private readonly actionRegistry: ActionRegistry,
  ) {}

  async handle(request: RequestMessage): Promise<unknown> {
    switch (request.action) {
      case "get_apps":
        return this.handleGetApps();
      case "execute":
        return this.handleExecute(request.payload);
      default: {
        const exhaustive: never = request.action;
        throw new ProtocolError(ActionErrorCode.INVALID_ACTION, `Unknown action: ${exhaustive}`);
      }
    }
  }

  private async handleGetApps(): Promise<{ apps: ReturnType<typeof toAppSummary>[] }> {
    const config = await this.configStore.loadConfig();
    const apps = [...config.apps]
      .sort((a, b) => a.position - b.position)
      .map(toAppSummary);
    return { apps };
  }

  private async handleExecute(rawPayload: unknown): Promise<void> {
    const { appId } = ExecutePayloadSchema.parse(rawPayload);
    const app = await this.configStore.loadApp(appId);
    if (!app) {
      throw new ProtocolError(
        ActionErrorCode.APPLICATION_NOT_FOUND,
        "O aplicativo configurado não foi encontrado.",
      );
    }
    await this.actionRegistry.execute(app.action.type, rawPayload);
  }
}
