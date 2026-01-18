import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [preact()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["components/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.output/**"],
    setupFiles: [resolve(__dirname, "test-setup.ts")],
    root: __dirname,
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
