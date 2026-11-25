import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { tz } from '../../db/columns';
import { session, user } from '../auth/auth.table';

// O login do app do computador (ver desktop.browser.ts e desktop.module.ts).

// Código de uso único entre o fim do login no navegador e o app: vale poucos minutos e só para quem
// tem o segredo cujo hash é o challenge (só o app que começou o login tem).
export const desktopLoginCode = pgTable('desktop_login_code', {
  codeHash: text('code_hash').primaryKey(),
  challenge: text('challenge').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', tz).notNull(),
});

// O computador de cada sessão, para a lista de aparelhos no Perfil. Some junto com a sessão.
export const desktopDevice = pgTable('desktop_device', {
  sessionId: text('session_id')
    .primaryKey()
    .references(() => session.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // darwin, win32, linux ou other.
  platform: text('platform').notNull(),
  lastSeenAt: timestamp('last_seen_at', tz).notNull().defaultNow(),
});
