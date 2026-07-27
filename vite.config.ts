import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // No `globals: true`. Every test imports describe/it/expect from 'vitest'
    // explicitly, so the test runner never becomes ambient in application code.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
