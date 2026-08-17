/**
 * Palette lifted from the "Aura Dark (Soft Text)" VS Code theme
 * (github.com/daltonmenezes/aura-theme). Aura pairs two accents rather than
 * one: soft green for primary actions/buttons, purple for
 * cursor/selection/focus — kept that split here instead of flattening to a
 * single accent color.
 */
export const colors = {
  bg: "#110f18",
  surface: "#15141b",
  surfaceRaised: "#1c1a24",
  border: "#3b334b",

  text: "#bdbdbd",
  textMuted: "#8f8b9c",
  textFaint: "#6d6d6d",

  accent: "#54c59f",
  accentHover: "#489f83",
  accentMuted: "rgba(84, 197, 159, 0.16)",

  purple: "#8464c6",
  purpleMuted: "rgba(132, 100, 198, 0.18)",

  success: "#54c59f",
  warning: "#c7a06f",
  danger: "#c55858",
  dangerMuted: "rgba(197, 88, 88, 0.16)",
} as const;
