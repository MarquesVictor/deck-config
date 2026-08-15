import { ActionErrorCode, ProtocolError } from "@stream-deck/shared";

export type ActionHandler<TPayload = unknown> = (payload: TPayload) => Promise<void>;

/**
 * Only actions registered here can ever run. There is no code path that
 * takes a client-supplied command or path and executes it directly.
 */
export class ActionRegistry {
  private readonly handlers = new Map<string, ActionHandler>();

  register<TPayload>(actionType: string, handler: ActionHandler<TPayload>): void {
    this.handlers.set(actionType, handler as ActionHandler);
  }

  async execute(actionType: string, payload: unknown): Promise<void> {
    const handler = this.handlers.get(actionType);
    if (!handler) {
      throw new ProtocolError(ActionErrorCode.INVALID_ACTION, `Unknown action: ${actionType}`);
    }
    await handler(payload);
  }
}
