import { z } from "zod";

export const OpenAppActionSchema = z.object({
  type: z.literal("open_app"),
  path: z.string().min(1),
});
export type OpenAppAction = z.infer<typeof OpenAppActionSchema>;

// Additional action kinds (volume, keyboard, url, obs, script) will extend
// this union as they are implemented; today only open_app is supported.
export const AppActionSchema = OpenAppActionSchema;
export type AppAction = z.infer<typeof AppActionSchema>;

export const AppSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  /** Data URL (PNG) extracted from the executable/app bundle's own icon, if any. Takes priority over `icon` when present. */
  iconImage: z.string().optional(),
  type: z.literal("application"),
  action: AppActionSchema,
  position: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type App = z.infer<typeof AppSchema>;

/** Shape sent to mobile clients: no filesystem paths, only what's needed to render a button. */
export const AppSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  iconImage: z.string().optional(),
  position: z.number(),
  actionType: z.literal("open_app"),
});
export type AppSummary = z.infer<typeof AppSummarySchema>;

export function toAppSummary(app: App): AppSummary {
  return {
    id: app.id,
    name: app.name,
    icon: app.icon,
    iconImage: app.iconImage,
    position: app.position,
    actionType: app.action.type,
  };
}
