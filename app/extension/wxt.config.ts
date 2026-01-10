import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: "dist",
  manifest: {
    name: "Service Policy Auditor",
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
        "@service-policy-auditor/csp",
        "@service-policy-auditor/detectors",
        "@service-policy-auditor/api",
        "@service-policy-auditor/extension-runtime",
      ],
    },
  }),
});
