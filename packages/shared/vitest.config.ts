import { defineConfig } from 'vitest/config';

// Testes da lógica compartilhada (pnpm test). Funções puras: sem Electron, sem disco.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
