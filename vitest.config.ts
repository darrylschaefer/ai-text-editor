import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfig from './tsconfig.json';

// Share the app's aliases without loading its browser/WASM build plugins.
const alias = Object.fromEntries(
  Object.entries(tsconfig.compilerOptions.paths).map(([name, [target]]) => [
    name.replace(/\/\*$/, ''),
    fileURLToPath(new URL(target.replace(/\/\*$/, ''), import.meta.url)),
  ])
);

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    allowOnly: !process.env.CI,
    passWithNoTests: false,
    restoreMocks: true,
  },
});
