import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: "dist",
  imports: false,
  manifest: {
    name: "Pleno Audit",
    version: "0.0.1",
    description:
      "Detect and visualize login pages, privacy policies, session cookies, and CSP violations",
    permissions: ["cookies", "storage", "activeTab", "alarms", "offscreen", "scripting"],
    host_permissions: ["<all_urls>"],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    web_accessible_resources: [
      {
        resources: ["api-hooks.js", "ai-hooks.js", "sql-wasm.wasm"],
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
    build: {
      target: "esnext",
    },
    optimizeDeps: {
      include: [
        "@pleno-audit/csp",
        "@pleno-audit/detectors",
        "@pleno-audit/api",
        "@pleno-audit/extension-runtime",
      ],
    },
  }),
});
