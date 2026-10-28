import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths, so the build works under a subpath such as GitHub Pages
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
