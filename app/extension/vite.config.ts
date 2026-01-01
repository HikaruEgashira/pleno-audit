import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import preact from "@preact/preset-vite";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: "popup/index.html",
      },
    },
  },
});
