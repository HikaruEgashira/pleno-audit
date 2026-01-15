import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: "dist",
  imports: false,
  manifest: (env) => {
    const isDev = env.mode === "development";
    const iconPrefix = isDev ? "icon-dev" : "icon";
    const isFirefox = env.browser === "firefox";

    // Base permissions (cross-browser)
    const basePermissions = ["cookies", "storage", "activeTab", "alarms", "webRequest", "management", "notifications"];

    // Chrome-specific permissions
    const chromePermissions = [...basePermissions, "offscreen", "scripting"];

    // Firefox permissions (no offscreen, no scripting in MV2)
    const firefoxPermissions = basePermissions;

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
      permissions: isFirefox ? firefoxPermissions : chromePermissions,
      host_permissions: ["<all_urls>"],
      content_security_policy: isFirefox
        ? "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
        : {
            extension_pages:
              "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
          },
      web_accessible_resources: isFirefox
        ? ["api-hooks.js", "ai-hooks.js", "sql-wasm.wasm", "parquet_wasm_bg.wasm"]
        : [
            {
              resources: ["api-hooks.js", "ai-hooks.js", "sql-wasm.wasm", "parquet_wasm_bg.wasm"],
              matches: ["<all_urls>"],
            },
          ],
      // Firefox-specific: browser_specific_settings
      ...(isFirefox && {
        browser_specific_settings: {
          gecko: {
            id: "pleno-audit@example.com",
            strict_min_version: "109.0",
          },
        },
      }),
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
