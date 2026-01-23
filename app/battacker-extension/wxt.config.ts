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
  manifest: (env) => {
    const isFirefox = env.browser === "firefox";
    const isSafari = env.browser === "safari";
    const isMV2 = isFirefox || isSafari;

    // Base permissions (cross-browser)
    const basePermissions = [
      "storage",
      "alarms",
      "tabs",
      "clipboardWrite",
      "downloads",
      "history",
      "management",
      "activeTab",
    ];

    // Chrome/Edge MV3 permissions
    const mv3Permissions = [...basePermissions, "scripting"];

    // Firefox/Safari MV2 permissions (no scripting API - uses tabs.executeScript)
    const mv2Permissions = basePermissions;

    return {
      name: "Pleno Battacker",
      version: "1.0.0",
      description: "Browser Defense Resistance Testing Tool - Simulates attack patterns to evaluate browser security",
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
          128: "icon-128.png",
        },
      },
      permissions: isMV2 ? mv2Permissions : mv3Permissions,
      host_permissions: ["<all_urls>"],
      // Content scripts registration
      content_scripts: [
        {
          matches: ["<all_urls>"],
          js: ["content-scripts/content.js"],
          run_at: "document_idle",
        },
      ],
      // Firefox-specific: browser_specific_settings
      ...(isFirefox && {
        browser_specific_settings: {
          gecko: {
            id: "pleno-battacker@example.com",
            strict_min_version: "109.0",
          },
        },
      }),
    };
  },
});
