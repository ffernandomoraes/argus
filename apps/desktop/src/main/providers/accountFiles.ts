import { rmSync } from 'node:fs';
import { MAIN_PROVIDER_ACCOUNT, type AccountKind, type ProviderAccountStatus, type ProviderId } from '@argus/shared/providers';
import { unlinkAgentsDir } from '../agents/accountLinks';
import { tr } from '../i18n';
import { errorMessage } from '../lib/errors';
import { deleteKey } from './keys';
import { ID, providerAccountDir } from './paths';

// Apaga a pasta de uma conta (a principal não tem pasta), com a chave e o link da biblioteca de agentes.
export function removeAccountDir(provider: ProviderId, id: string): void {
  const dir = providerAccountDir(provider, id);
  if (!dir || !ID.test(id)) return;
  deleteKey(provider, id);
  unlinkAgentsDir(provider, dir);
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch (err) {
    console.warn('[providers] não deu para apagar a pasta da conta:', dir, errorMessage(err));
  }
}

// Nome sugerido: o e-mail da conta; chave sem e-mail, o final dela.
export function suggestName(id: string, kind: AccountKind, status: ProviderAccountStatus | null, taken: Set<string>): string {
  const email = status?.email;
  if (email) return taken.has(email) ? `${email} (${id})` : email;
  if (kind === 'key' && status?.keyHint) return tr(`Chave ${status.keyHint}`, `Key ${status.keyHint}`);
  return id === MAIN_PROVIDER_ACCOUNT ? tr('Do terminal', 'From terminal') : tr('Conta', 'Account');
}
