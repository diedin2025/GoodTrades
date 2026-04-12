import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  build: {
    outDir: "MorganHacks",
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  plugins: [react()],
});
