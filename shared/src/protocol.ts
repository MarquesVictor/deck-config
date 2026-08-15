import { z } from "zod";
import { ActionErrorCode } from "./errors";

/**
 * Current protocol major version. Agent may accept older versions for
 * backward compatibility; mismatches beyond what the Agent supports are
 * rejected with PROTOCOL_VERSION_MISMATCH.
 */
export const CURRENT_PROTOCOL_VERSION = 1;

export const RequestActionSchema = z.enum(["get_apps", "execute"]);
export type RequestAction = z.infer<typeof RequestActionSchema>;

export const ExecutePayloadSchema = z.object({
  appId: z.string().min(1),
});
export type ExecutePayload = z.infer<typeof ExecutePayloadSchema>;

export const RequestMessageSchema = z.object({
  protocolVersion: z.number().int().positive(),
  type: z.literal("request"),
  requestId: z.string().min(1),
  machineId: z.string().min(1),
  action: RequestActionSchema,
  payload: z.unknown().optional(),
});
export type RequestMessage = z.infer<typeof RequestMessageSchema>;

export const ErrorPayloadSchema = z.object({
  code: z.nativeEnum(ActionErrorCode),
  message: z.string(),
  timestamp: z.string().optional(),
  details: z.unknown().optional(),
});
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

export const ResponseMessageSchema = z.object({
  type: z.literal("response"),
  requestId: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: ErrorPayloadSchema.optional(),
});
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;

export const AgentReadyEventSchema = z.object({
  type: z.literal("event"),
  event: z.literal("agent_ready"),
  agent: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    protocolVersion: z.number().int().positive(),
  }),
});
export type AgentReadyEvent = z.infer<typeof AgentReadyEventSchema>;

export const AppsUpdatedEventSchema = z.object({
  type: z.literal("event"),
  event: z.literal("apps_updated"),
  apps: z.array(z.unknown()),
});
export type AppsUpdatedEvent = z.infer<typeof AppsUpdatedEventSchema>;

export const EventMessageSchema = z.discriminatedUnion("event", [
  AgentReadyEventSchema,
  AppsUpdatedEventSchema,
]);
export type EventMessage = z.infer<typeof EventMessageSchema>;

export const PingMessageSchema = z.object({
  type: z.literal("ping"),
  timestamp: z.number(),
});
export type PingMessage = z.infer<typeof PingMessageSchema>;

export const PongMessageSchema = z.object({
  type: z.literal("pong"),
  timestamp: z.number(),
});
export type PongMessage = z.infer<typeof PongMessageSchema>;

export const InboundMessageSchema = z.discriminatedUnion("type", [
  RequestMessageSchema,
  PongMessageSchema,
]);
export type InboundMessage = z.infer<typeof InboundMessageSchema>;

export const OutboundMessageSchema = z.union([
  ResponseMessageSchema,
  EventMessageSchema,
  PingMessageSchema,
]);
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;
