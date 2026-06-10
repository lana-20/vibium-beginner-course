import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    testTimeout: Number(process.env.TEST_TIMEOUT ?? 60_000),
    hookTimeout: 30_000,
    include: ['src/**/*.test.ts'],
  }
})
