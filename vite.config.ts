import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig(({ command }) => ({
  base: '/prices/',
  plugins: [
    command === 'serve' ? mkcert() : null,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Price Checker',
        short_name: 'Prices',
        description: 'Scan barcodes in-store and compare prices',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'fullscreen',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Tesseract WASM and trained data can be large — cache them
        runtimeCaching: [
          {
            urlPattern: /tesseract/,
            handler: 'CacheFirst',
            options: { cacheName: 'tesseract-assets', expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /world\.openfoodfacts\.org/,
            handler: 'NetworkFirst',
            options: { cacheName: 'off-api', networkTimeoutSeconds: 2 },
          },
        ],
      },
    }),
  ],
}))
