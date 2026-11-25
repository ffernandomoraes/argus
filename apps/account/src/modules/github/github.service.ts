import { eq } from 'drizzle-orm';

import type { Config } from '../../config';
import type { Database } from '../../db/client';
import { createSealer, type Sealer } from '../../lib/crypto';
import { GitHubAuthError, refreshTokens, revokeGrant, type GitHubTokens } from './github.client';
import type { Connected } from './github.flows';
import { githubLink } from './github.table';

// A conexão guardada de cada pessoa: gravar, ler a chave de acesso (renovando quando está para
// vencer) e apagar.

// Renova com folga: a chave entregue ao app ainda vale pelo clone inteiro.
const RENEW_BEFORE_MS = 30 * 60_000;

export type AccessToken = { token: string; expiresAt: Date | null };

export class GitHubLinks {
  private readonly sealer: Sealer;

  constructor(
    private readonly db: Database,
    private readonly config: Config,
  ) {
    this.sealer = createSealer(config.BETTER_AUTH_SECRET, 'github-link');
  }

  private sealed(tokens: GitHubTokens) {
    return {
      accessToken: this.sealer.seal(tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshToken: tokens.refreshToken ? this.sealer.seal(tokens.refreshToken) : null,
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
  }

  async save(userId: string, { tokens, githubId, login }: Connected): Promise<void> {
    const values = { githubId, login, ...this.sealed(tokens) };
    await this.db
      .insert(githubLink)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: githubLink.userId, set: values });
  }

  async login(userId: string): Promise<string | null> {
    const [row] = await this.db.select({ login: githubLink.login }).from(githubLink).where(eq(githubLink.userId, userId));
    return row?.login ?? null;
  }

  // A chave de acesso valendo. Nula: sem conexão. GitHubAuthError: a conexão acabou (quem chamou apaga).
  // A linha fica presa durante a renovação: dois pedidos juntos não gastam a mesma renovação (o
  // GitHub só aceita cada uma uma vez).
  async accessToken(userId: string, now = Date.now()): Promise<AccessToken | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(githubLink).where(eq(githubLink.userId, userId)).for('update');
      if (!row) return null;
      const token = this.sealer.open(row.accessToken);
      if (token && (!row.accessExpiresAt || row.accessExpiresAt.getTime() - now > RENEW_BEFORE_MS)) return { token, expiresAt: row.accessExpiresAt };
      const refresh = row.refreshToken ? this.sealer.open(row.refreshToken) : null;
      if (!refresh || (row.refreshExpiresAt && row.refreshExpiresAt.getTime() <= now)) throw new GitHubAuthError('renovação vencida');
      const fresh = await refreshTokens(this.config, refresh);
      await tx.update(githubLink).set(this.sealed(fresh)).where(eq(githubLink.userId, userId));
      return { token: fresh.accessToken, expiresAt: fresh.accessExpiresAt };
    });
  }

  // Apaga daqui e, se `revoke`, desfaz a autorização no GitHub. O GitHub só desfaz com uma chave
  // de acesso valendo (dura 8 horas): a guardada é renovada antes, se preciso. Sem renovação possível
  // (vencida há mais de 6 meses), fica só o registro: a pessoa desfaz em github.com/settings/apps/authorizations.
  async remove(userId: string, revoke: boolean): Promise<void> {
    const token = revoke ? await this.accessToken(userId).catch(() => null) : null;
    const [row] = await this.db.delete(githubLink).where(eq(githubLink.userId, userId)).returning({ userId: githubLink.userId });
    if (row && revoke && !token) console.warn('[account] GitHub: autorização não desfeita (chave vencida)');
    if (token) await revokeGrant(this.config, token.token).catch((err: unknown) => console.warn('[account] GitHub: autorização não desfeita:', err instanceof Error ? err.message : err));
  }
}
