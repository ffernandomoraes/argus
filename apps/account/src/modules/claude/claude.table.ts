import { integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { updatedAt } from '../../db/columns';
import { user } from '../auth/auth.table';

// CLAUDE.md, skills, agentes e comandos da pessoa: a última versão de cada arquivo, pelo caminho
// dentro do ~/.claude ("skills/pdf/SKILL.md"). O hash (sha256 do texto) é o que os computadores
// comparam para saber o que mudou.
export const claudeFile = pgTable(
  'claude_file',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    content: text('content').notNull(),
    hash: text('hash').notNull(),
    size: integer('size').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.path] })],
);
