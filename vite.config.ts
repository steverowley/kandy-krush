import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export default defineConfig({
  base: "./",
  plugins: [preact()],
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: "happy-dom",
    css: false,
  },
});
