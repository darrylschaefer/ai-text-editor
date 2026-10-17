import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@icon': fileURLToPath(new URL('./src/assets/icons', import.meta.url)),
      '@type': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@store': fileURLToPath(new URL('./src/store', import.meta.url)),
      '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@constants': fileURLToPath(new URL('./src/constants', import.meta.url)),
      '@api': fileURLToPath(new URL('./src/api', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@nodes': fileURLToPath(new URL('./src/nodes', import.meta.url)),
      '@src': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: './',
});
