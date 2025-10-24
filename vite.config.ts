import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Use global root dir if available (production bundle), otherwise process.cwd() (dev)
const rootDir = (globalThis as any).__projectRoot || process.cwd();

// Standalone Vite config

export default defineConfig({
  plugins: [
  react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "client", "src"),
      "@shared": path.resolve(rootDir, "shared"),
      "@assets": path.resolve(rootDir, "attached_assets"),
    },
  },
  root: path.resolve(rootDir, "client"),
  build: {
    outDir: path.resolve(rootDir, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
