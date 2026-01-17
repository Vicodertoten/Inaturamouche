// vite.config.js — Inaturamouche (PWA : règles séparées pour quiz vs meta-API)
// Basé sur ton fichier : manifeste conservé, SW en generateSW, proxy dev.
// Changements clés PWA :
//  - /api/quiz-question => NetworkOnly (toujours frais, anti-répétitions)
//  - /api/taxa/autocomplete & /api/observations/species_counts => StaleWhileRevalidate
//  - images iNaturalist => CacheFirst (TTL 7 jours)

import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@contexts": path.resolve(__dirname, "./src/context"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@styles": path.resolve(__dirname, "./src/styles"),
      "@locales": path.resolve(__dirname, "./src/locales"),
    },
  },
  plugins: [
    splitVendorChunkPlugin(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        'fonts/*.woff2', // Include fonts for caching
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
          // 0) Fonts: CacheFirst for performance
          {
            urlPattern: /\.woff2$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 year
              cacheableResponse: { statuses: [200] },
            },
          },
          // 1) META-API en SWR (autocomplete + species_counts)
          {
            urlPattern: ({ url }) =>
              /^\/api\/(taxa\/autocomplete|observations\/species_counts)/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-meta-swr",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 }, // 1h
              cacheableResponse: { statuses: [200] },
            },
          },
          // 2) QUIZ en NetworkOnly (évite de resservir la même question)
          {
            urlPattern: ({ url }) => url.pathname === "/api/quiz-question",
            handler: "NetworkOnly",
            options: {
              cacheName: "api-quiz-no-cache",
            },
          },
          // 3) Catch-all API : NetworkOnly (sécurité)
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            options: {
              cacheName: "api-no-cache",
            },
          },
          // 4) Images iNaturalist : CacheFirst avec TTL
          {
            urlPattern: /^https:\/\/static\.inaturalist\.org\/photos\//,
            handler: "CacheFirst",
            options: {
              cacheName: "inat-photos",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\//,
            handler: "CacheFirst",
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router-dom")) return "router";
          if (id.includes("react-dom") || id.includes("react")) return "react";
          if (id.includes("d3")) return "d3";
          if (id.includes("leaflet") || id.includes("react-leaflet")) return "leaflet";
          return "vendor";
        },
      },
    },
  },
});
