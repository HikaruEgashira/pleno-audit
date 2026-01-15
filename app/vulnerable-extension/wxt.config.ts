import { defineConfig } from "wxt";

export default defineConfig({
  outDir: "dist",
  manifest: {
    name: "Vulnerable Test Extension",
    version: "1.0.0",
    description: "Test extension for verifying external communication detection",
    permissions: ["storage", "alarms"],
    host_permissions: ["<all_urls>"],
  },
});
