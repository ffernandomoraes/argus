import { defineConfig } from 'vitest/config';

// Testes da API com o banco em memória (PGlite): sem Postgres, sem rede.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
