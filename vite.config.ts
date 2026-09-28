import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'maskable-512x512.png'],
      manifest: {
        id: '/MALrepo/',
        name: 'MAL Sheet',
        short_name: 'MAL Sheet',
        description: 'Explore sua lista do MyAnimeList, descubra animes e jogue com o seu histórico.',
        start_url: '/MALrepo/',
        scope: '/MALrepo/',
        display: 'standalone',
        background_color: '#f5f7fb',
        theme_color: '#172554',
        orientation: 'any',
        categories: ['entertainment', 'lifestyle'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallback: '/MALrepo/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  base: '/MALrepo/',
})
