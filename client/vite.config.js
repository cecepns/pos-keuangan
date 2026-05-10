import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    /**
     * Pastikan seluruh dependency tree memakai SATU salinan react & react-dom
     * dari client/node_modules (tidak ada root node_modules yang menyaingi).
     */
    dedupe: ["react", "react-dom"],
  },
  /**
   * Sertakan zustand ke pre-bundle Vite agar ia memakai instance React yang
     * sama dengan react-router-dom, react-hot-toast, dll.
   * Jangan pernah exclude zustand — itu penyebab "Invalid hook call".
   */
  optimizeDeps: {
    include: ["react", "react-dom", "zustand", "zustand/middleware"],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
