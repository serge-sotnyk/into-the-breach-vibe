import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // relative asset paths, so the build works under a subpath such as GitHub Pages
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  plugins: [
    // installable, fullscreen and offline: every built file is precached by a service worker
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'IRON GRID — Mech Tactics',
        short_name: 'IRON GRID',
        description: 'A turn-based mech tactics game: read the Vek attacks and protect the power grid.',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        theme_color: '#0b1018',
        background_color: '#080c12',
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
});
