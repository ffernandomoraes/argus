import { timestamp } from 'drizzle-orm/pg-core';

// Colunas de data iguais em todas as tabelas (padrão do codes-modules).

export const tz = { withTimezone: true, mode: 'date' } as const;

export const createdAt = () => timestamp('created_at', tz).notNull().defaultNow();

export const updatedAt = () =>
  timestamp('updated_at', tz)
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
