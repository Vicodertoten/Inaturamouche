// vite.config.ts — Inaturamouche (PWA : API en NetworkOnly)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        // ajoute ici tes favicons si besoin
      ],
      manifest: {
        name: "Inaturamouche",
        short_name: "Inatura",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0E7C86",
        icons: [
          // Assure-toi que ces fichiers existent dans /public/icons/
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // Ne jamais faire tomber /api/ dans la navigation fallback SPA
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // 1) API : NE PAS CACHER (source du bug côté SW)
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            options: {
              cacheName: "api-no-cache",
            },
          },
          // 2) Images iNaturalist : cache raisonnable en SWR
          {
            urlPattern: /^https:\/\/static\.inaturalist\.org\/photos\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "inat-photos",
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 jours
              },
            },
          },
          // (optionnel) anciens domaines d'images iNat
          {
            urlPattern: /^https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "inat-photos-legacy",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // permet de tester le SW en dev
      },
    }),
  ],
  server: {
    port: 5173,
    open: false,
    // Proxy utile en dev : le front appelle /api => redirigé vers localhost:3001
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
    target: "esnext",
  },
});
