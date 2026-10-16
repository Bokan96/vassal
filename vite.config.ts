/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { textsPlugin } from './scripts/texts-plugin.ts';

export default defineConfig({
  plugins: [react(), textsPlugin()],
  base: './',
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
