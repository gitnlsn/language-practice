import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the app from https://gitnlsn.github.io/language-practice/
  base: command === "build" ? "/language-practice/" : "/",
  // espeak-ng resolves its .wasm relative to import.meta.url; pre-bundling breaks that.
  optimizeDeps: { exclude: ["espeak-ng"] },
  worker: { format: "es" },
}));
