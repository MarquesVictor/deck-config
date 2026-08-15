export const ActionErrorCode = {
  APPLICATION_NOT_FOUND: "APPLICATION_NOT_FOUND",
  APPLICATION_LAUNCH_FAILED: "APPLICATION_LAUNCH_FAILED",
  APPLICATION_ALREADY_RUNNING: "APPLICATION_ALREADY_RUNNING",

  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_MACHINE_ID: "INVALID_MACHINE_ID",

  PROTOCOL_VERSION_MISMATCH: "PROTOCOL_VERSION_MISMATCH",
  INVALID_ACTION: "INVALID_ACTION",
  MISSING_PAYLOAD: "MISSING_PAYLOAD",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  INTERNAL_ERROR: "INTERNAL_ERROR",
  TIMEOUT: "TIMEOUT",
} as const;

export type ActionErrorCode = (typeof ActionErrorCode)[keyof typeof ActionErrorCode];

export class ProtocolError extends Error {
  constructor(
    public readonly code: ActionErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProtocolError";
  }
}
