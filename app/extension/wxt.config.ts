import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: "dist",
  imports: false,
  manifest: (env) => {
    const isDev = env.mode === "development";
    const iconPrefix = isDev ? "icon-dev" : "icon";
    return {
      name: isDev ? "[DEV] Pleno Audit" : "Pleno Audit",
      version: "0.0.1",
      description: "Personal Browser Security",
      icons: {
        16: `${iconPrefix}-16.png`,
        32: `${iconPrefix}-32.png`,
        48: `${iconPrefix}-48.png`,
        128: `${iconPrefix}-128.png`,
      },
      action: {
        default_icon: {
          16: `${iconPrefix}-16.png`,
          32: `${iconPrefix}-32.png`,
          48: `${iconPrefix}-48.png`,
        },
      },
      permissions: ["cookies", "storage", "activeTab", "alarms", "offscreen", "scripting", "webRequest", "management", "notifications"],
      host_permissions: ["<all_urls>"],
      content_security_policy: {
        extension_pages:
          "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      },
      web_accessible_resources: [
        {
          resources: ["api-hooks.js", "ai-hooks.js", "sql-wasm.wasm", "parquet_wasm_bg.wasm"],
          matches: ["<all_urls>"],
        },
      ],
    };
  },
  vite: () => ({
    plugins: [],
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "preact",
    },
    build: {
      target: "esnext",
      rollupOptions: {
        external: ["parquet-wasm"],
      },
    },
    optimizeDeps: {
      include: [
        "@pleno-audit/csp",
        "@pleno-audit/detectors",
        "@pleno-audit/api",
        "@pleno-audit/extension-runtime",
        "@pleno-audit/parquet-storage",
      ],
      exclude: ["parquet-wasm"],
    },
  }),
});
