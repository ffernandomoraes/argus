import { defineConfig } from 'drizzle-kit';

// Migrações geradas a partir de src/db/schema.ts (pnpm --filter @argus/account db:generate) e
// aplicadas pela API ao subir.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL?.startsWith('postgres') ? process.env.DATABASE_URL : 'postgres://localhost:5432/account',
  },
});
