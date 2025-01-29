import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: [
      {
        extends: true,
        test: {
          environment: 'jsdom',
        },
      },
    ],
  },
});
