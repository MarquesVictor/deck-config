export const ICONS: Record<string, string> = {
  gamepad: "🎮",
  music: "🎵",
  chat: "💬",
  globe: "🌐",
  folder: "📁",
  tools: "🛠️",
  settings: "⚙️",
  camera: "🎥",
  photo: "📷",
  film: "🎬",
  document: "📝",
  chart: "📊",
  palette: "🎨",
  wrench: "🔧",
  box: "📦",
  key: "🔑",
  user: "👤",
  home: "🏠",
};

export function iconFor(id: string): string {
  return ICONS[id] ?? "📦";
}
