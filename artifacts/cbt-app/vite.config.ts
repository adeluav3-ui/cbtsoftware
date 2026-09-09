import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "images/**/*"],
      manifest: {
        name: "CBT Portal",
        short_name: "CBT",
        description: "Computer Based Testing Platform",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // woff2 covers the self-hosted Inter/Outfit fonts — precached on first install
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [],
        // Take control of all tabs immediately on activation so users never
        // run old code after a deploy. Without this, Chrome keeps the old SW
        // active until every tab is closed, serving stale JS that references
        // asset filenames that no longer exist → blank page.
        clientsClaim: true,
        // Remove caches from previous SW versions on activation to prevent
        // stale assets being served after a deploy.
        cleanupOutdatedCaches: true,
        // Serve precached index.html for all navigation requests so the SPA
        // works offline and after a connection drop mid-session.
        // Exclude /api/* so backend requests are never served from cache.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "https://cbtsoftware-api.fly.dev",
        changeOrigin: true,
        secure: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});