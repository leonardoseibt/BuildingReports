import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Use process.cwd() which works reliably in both dev and bundled production
const rootDir = process.cwd();

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
