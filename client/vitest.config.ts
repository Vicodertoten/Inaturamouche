import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
    css: true,
    include: ['src/**/__tests__/**/*.test.{js,jsx,ts,tsx}', 'src/**/__tests__/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
});
