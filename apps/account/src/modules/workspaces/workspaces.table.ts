import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { updatedAt } from '../../db/columns';
import { session, user } from '../auth/auth.table';

// O desenho dos workspaces de cada computador (grupos, cards de pasta, notas), que outro computador
// da conta traz como cópia. Uma linha por aparelho, trocada inteira a cada envio. Some junto com a
// sessão: o computador removido ou que saiu da conta deixa de aparecer.
export const deviceWorkspaces = pgTable(
  'device_workspaces',
  {
    sessionId: text('session_id')
      .primaryKey()
      .references(() => session.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    snapshot: jsonb('snapshot').notNull(),
    // O resumo de cada workspace (nome e contagens) para a lista, sem carregar o desenho inteiro. Nulo:
    // linha de antes do resumo existir (vem do desenho até o próximo envio).
    summary: jsonb('summary'),
    updatedAt: updatedAt(),
  },
  (table) => [index('device_workspaces_user_idx').on(table.userId)],
);
