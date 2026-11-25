import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { tz, updatedAt } from '../../db/columns';
import { user } from '../auth/auth.table';

// O GitHub conectado à conta (app "Argus" no GitHub, só leitura dos repositórios que a pessoa
// liberou): um por pessoa, valendo em todos os computadores dela. As chaves ficam cifradas
// (lib/crypto.ts createSealer): a de acesso vence em 8 horas e a de renovação em 6 meses.
export const githubLink = pgTable('github_link', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  githubId: text('github_id').notNull(),
  login: text('login').notNull(),
  accessToken: text('access_token').notNull(),
  // Nulo: o app do GitHub não faz a chave vencer.
  accessExpiresAt: timestamp('access_expires_at', tz),
  refreshToken: text('refresh_token'),
  refreshExpiresAt: timestamp('refresh_expires_at', tz),
  updatedAt: updatedAt(),
});
