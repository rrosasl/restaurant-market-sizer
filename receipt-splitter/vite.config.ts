import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Dividir la cuenta',
        short_name: 'La cuenta',
        description: 'Divide la cuenta del restaurante entre amigos.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#f8fafc',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Receipt parsing is the one thing that needs the network. Everything
        // else — entering a bill, assigning, totals, history — works offline,
        // so the API route must never be served from a cache.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^.*\/api\/.*$/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
