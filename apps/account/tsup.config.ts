import { defineConfig } from 'tsup';

// Build da Railway (pnpm --filter @argus/account build): um server.js em dist/, com as dependências
// lidas do node_modules ao rodar.
export default defineConfig({
  entry: ['src/server.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: true,
  external: ['@electric-sql/pglite'],
});
