import { sql } from 'drizzle-orm';

import { user } from '../modules/auth/auth.table';

// Trava a linha da pessoa até o fim da transação: quem confere um limite (arquivos, preferências) e
// grava em seguida não passa junto com outro pedido da mesma pessoa. A linha da pessoa sempre existe;
// travar só as linhas dos dados não segura dois primeiros envios ao mesmo tempo (ainda não há linha).
type Executor = { execute(query: ReturnType<typeof sql>): Promise<unknown> };

export async function lockUser(tx: Executor, userId: string): Promise<void> {
  await tx.execute(sql`select 1 from ${user} where ${user.id} = ${userId} for update`);
}
