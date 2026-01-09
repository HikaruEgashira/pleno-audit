import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: "dist",
  manifest: {
    name: "Service Policy Controller",
    version: "0.0.1",
    description:
      "Detect and visualize login pages, privacy policies, session cookies, and CSP violations",
    permissions: ["cookies", "storage", "activeTab", "alarms"],
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["api-hooks.js"],
        matches: ["<all_urls>"],
      },
    ],
  },
  vite: () => ({
    plugins: [],
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "preact",
    },
  }),
});
