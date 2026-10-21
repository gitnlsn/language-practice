import { defineConfig } from "vite";

export default defineConfig({
  // espeak-ng resolves its .wasm relative to import.meta.url; pre-bundling breaks that.
  optimizeDeps: { exclude: ["espeak-ng"] },
  worker: { format: "es" },
});
