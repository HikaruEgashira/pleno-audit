import { defineConfig } from "wxt";
import preact from "@preact/preset-vite";

export default defineConfig({
  outDir: "dist",
  vite: () => ({
    plugins: [preact()],
    esbuild: {
      jsxFactory: "h",
      jsxFragment: "Fragment",
    },
  }),
  manifest: {
    name: "Pleno Battacker",
    version: "1.0.0",
    description: "Browser Defense Resistance Testing Tool - Simulates attack patterns to evaluate browser security",
    permissions: [
      "storage",
      "alarms",
      "tabs",
      "clipboardWrite",
      "downloads",
      "history",
      "scripting",
      "management",
    ],
    host_permissions: ["<all_urls>"],
  },
});
