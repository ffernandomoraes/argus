import { eq } from 'drizzle-orm';

import { isProvider, type Provider } from '../../config';
import type { Database } from '../../db/client';
import { account } from '../auth/auth.table';

// O perfil como o app do computador lê (apps/desktop/src/main/account/profile.ts): nome, e-mail,
// foto (o app baixa) e os logins ligados.

export type Profile = {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
  identities: { provider: Provider; login: string | null; email: string | null }[]
};

type ProfileUser = { id: string; name: string; email: string; image?: string | null };

export async function profileOf(db: Database, user: ProfileUser): Promise<Profile> {
  const rows = await db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, user.id)).orderBy(account.createdAt);
  const providers = [...new Set(rows.map((r) => r.providerId))].filter(isProvider);
  return {
    id: user.id,
    name: user.name,
    email: user.email || null,
    avatarUrl: user.image ?? null,
    identities: providers.map((provider) => ({ provider, login: null, email: null })),
  };
}
