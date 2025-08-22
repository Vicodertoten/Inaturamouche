import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'assets/*.png',
        'offline.html',
        'packs/*.json'
      ],
      manifest: {
        name: 'Inaturamouche',
        short_name: 'Inaturamouche',
        description: 'Un quiz pour tester vos connaissances sur la nature.',
        theme_color: '#283618',
        background_color: '#283618',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/static\.inaturalist\.org\/.*$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'inaturalist-images',
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ],
        navigateFallback: '/offline.html'
      }
    })
  ],
})

