import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'app-icon-192.png', 'app-icon-512.png'],
    manifest: {
      name: 'Travel App — Budget voyage',
      short_name: 'Travel App',
      description: 'Votre budget de voyage en euros, seul ou avec vos compagnons.',
      lang: 'fr',
      theme_color: '#193847',
      background_color: '#f7efe6',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      // Only application files are cached. Firebase traffic and budget data use the SDK's private cache.
      navigateFallbackDenylist: [/^\/__/],
    },
  })],
})
