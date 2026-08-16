import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  optimizeDeps: {
    // @stream-deck/shared is a linked workspace package whose CJS build
    // re-exports icons.ts via a dynamic __exportStar helper. Vite's
    // lightweight per-file CJS-named-export scan can't see through that,
    // so named imports like `ICONS`/`iconFor` fail unless this package goes
    // through full esbuild pre-bundling instead.
    include: ["@stream-deck/shared"],
  },
  build: {
    outDir: "../../../../dist/ui/electron/renderer",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
