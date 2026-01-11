import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: "dist",
  imports: false,
  manifest: {
    name: "Pleno Audit",
    version: "0.0.1",
    description: "Personal Browser Security",
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    action: {
      default_icon: {
        16: "icon-16.png",
        32: "icon-32.png",
        48: "icon-48.png",
      },
    },
    permissions: ["cookies", "storage", "activeTab", "alarms", "offscreen", "scripting", "webRequest", "management"],
    host_permissions: ["<all_urls>"],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    web_accessible_resources: [
      {
        resources: ["input-hooks.js", "sql-wasm.wasm"],
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
