import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/pleno-audit/battacker/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
