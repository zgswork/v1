/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode offline` produces a single self-contained index.html (JS/CSS/fonts/
// worker all inlined) that runs straight from file:// with no web server.
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline'
  return {
    base: offline ? './' : '/',
    build: { outDir: offline ? 'dist-offline' : 'dist' },
    plugins: [
      react(),
      VitePWA({
        // No service worker / manifest in the single-file offline build — they
        // can't load over file://. Disabled still exports a no-op registerSW.
        disable: offline,
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
        manifest: {
          name: 'PDF 加水印',
          short_name: 'PDF水印',
          description: '本地为 PDF 添加文字/图片水印，文件不上传',
          theme_color: '#ffc107',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
        workbox: {
          // Include ttf so the bundled CJK fonts are precached for offline use
          // (Workbox's default globPatterns omit font files).
          globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf}'],
          maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        },
      }),
      // Inline everything into one HTML for the offline build (must run last).
      ...(offline ? [viteSingleFile()] : []),
    ],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
    },
  }
})
