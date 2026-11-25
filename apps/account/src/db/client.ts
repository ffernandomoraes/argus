import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';

import { migrationsFolder } from '../lib/paths';
import * as schema from './schema';

// O banco: o Postgres da Railway em produção, o PGlite (Postgres em WebAssembly, sem instalar nada)
// no dev e nos testes. As migrações (pasta drizzle/) são aplicadas ao subir. Padrão do codes-modules.

export { schema };

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseConnection {
  db: Database
  migrate(): Promise<void>
  close(): Promise<void>
}

export const PGLITE_PREFIX = 'pglite:';

const CONNECTION_ERROR_CODES = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', '57P03']);
const MIGRATION_MAX_WAIT_MS = 120_000;

export function createDatabase(databaseUrl: string): Promise<DatabaseConnection> {
  return databaseUrl.startsWith(PGLITE_PREFIX) ? createPgliteDatabase(databaseUrl) : Promise.resolve(createPostgresDatabase(databaseUrl));
}

function createPostgresDatabase(databaseUrl: string): DatabaseConnection {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 5 * 60_000, keepAlive: true });
  pool.on('error', (error) => {
    console.error('[db] Conexão ociosa com o Postgres caiu:', error.message);
  });
  return {
    db: drizzle(pool, { schema }),
    migrate: () => migratePostgres(databaseUrl),
    close: () => pool.end(),
  };
}

async function createPgliteDatabase(databaseUrl: string): Promise<DatabaseConnection> {
  const [{ PGlite }, pglite, pgliteMigrator] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ]);
  const location = databaseUrl.slice(PGLITE_PREFIX.length).replace(/^\/\//, '');
  const inMemory = location === '' || location === 'memory';
  if (!inMemory) mkdirSync(path.dirname(path.resolve(location)), { recursive: true });
  const client = inMemory ? new PGlite() : new PGlite(location);
  const db = pglite.drizzle(client, { schema });
  return {
    db,
    migrate: () => pgliteMigrator.migrate(db, { migrationsFolder: migrationsFolder() }),
    close: () => client.close(),
  };
}

function isConnectionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, errors, cause } = error as { code?: unknown; errors?: unknown; cause?: unknown };
  if (typeof code === 'string' && CONNECTION_ERROR_CODES.has(code)) return true;
  if (Array.isArray(errors) && errors.some(isConnectionError)) return true;
  return cause !== undefined && isConnectionError(cause);
}

// O Postgres da Railway pode subir depois da API: tenta de novo por até 2 minutos.
async function migratePostgres(databaseUrl: string): Promise<void> {
  const startedAt = Date.now();
  for (let attempt = 1; ; attempt += 1) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
    try {
      await migrate(drizzle(pool), { migrationsFolder: migrationsFolder() });
      return;
    } catch (error) {
      if (!isConnectionError(error) || Date.now() - startedAt > MIGRATION_MAX_WAIT_MS) throw error;
      const delay = Math.min(1_000 * 2 ** (attempt - 1), 10_000);
      console.warn(`[db] Banco indisponível (tentativa ${attempt}), tentando de novo em ${delay / 1000} s`);
      await sleep(delay);
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
}
