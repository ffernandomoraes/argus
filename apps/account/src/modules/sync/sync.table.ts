import { index, integer, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { updatedAt } from '../../db/columns';
import { user } from '../auth/auth.table';

// Preferências sincronizadas: uma linha por preferência. A versão vem do contador da pessoa, que
// sobe a cada gravação; o app pede só o que tem versão maior que a última que ele viu.

export const syncCounter = pgTable('sync_counter', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(0),
});

export const syncItem = pgTable(
  'sync_item',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    version: integer('version').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] }), index('sync_item_version_idx').on(table.userId, table.version)],
);
