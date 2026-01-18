import { defineConfig } from "wxt";
import preact from "@preact/preset-vite";

export default defineConfig({
  // Use separate output dir for dev to avoid conflicts with manually loaded extensions
  outDir: process.env.DEBUG_PORT ? ".wxt-dev" : "dist",
  webExt: {
    startUrls: ["https://example.com"],
    chromiumArgs: ["--remote-debugging-port=9223"],
  },
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
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    permissions: [
      "storage",
      "alarms",
      "tabs",
      "clipboardWrite",
      "downloads",
      "history",
      "scripting",
      "management",
      "activeTab",
    ],
    host_permissions: ["<all_urls>"],
    // Explicitly define content_scripts to ensure they're included in dev mode
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content-scripts/content.js"],
        run_at: "document_idle",
      },
    ],
  },
});
