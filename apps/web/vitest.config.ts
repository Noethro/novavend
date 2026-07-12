import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    env: { NEXT_PUBLIC_PREVIEW_MODE: 'true' },
    environment: 'jsdom',
  },
});
