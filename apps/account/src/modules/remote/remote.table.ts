import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { tz, updatedAt } from '../../db/columns';
import { session, user } from '../auth/auth.table';

// Acesso remoto pela conta: cada computador com "Permitir acesso" ligado publica aqui a sala dele na
// ponte e um código de pareamento sempre aberto (renovado a cada poucos minutos). Os outros aparelhos
// da mesma conta pegam o código e pareiam sem digitar nada; a ligação continua cifrada de ponta a
// ponta pelo pareamento de sempre. Some junto com a sessão do computador.
export const remoteHost = pgTable(
  'remote_host',
  {
    sessionId: text('session_id')
      .primaryKey()
      .references(() => session.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // A sala do computador na ponte (o mesmo id que o pareamento entrega).
    hostId: text('host_id').notNull(),
    code: text('code').notNull(),
    codeExpiresAt: timestamp('code_expires_at', tz).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [index('remote_host_user_idx').on(table.userId)],
);
