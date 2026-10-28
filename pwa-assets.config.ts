import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Icons for the installed app, generated from the favicon; padded icons get the game's dark background.
const dark = { resizeOptions: { background: '#0b1018' } };

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: { ...preset, maskable: { ...preset.maskable, ...dark }, apple: { ...preset.apple, ...dark } },
  images: ['public/favicon.svg'],
});
