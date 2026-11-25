import { join } from 'node:path';
import { app } from 'electron';
import { ACCOUNT_PROVIDERS, type AccountDevice, type AccountIdentity, type AccountProfile, type AccountProvider } from '@argus/shared/account';
import type { Hashes } from '@argus/shared/accountClaude';
import { normalizeMemory, type SyncMemory } from '@argus/shared/accountSync';
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile';

// O que a conta guarda neste computador, fora o token (no cofre, ver tokenStore.ts): o perfil, para a
// tela abrir sem esperar a rede, e a memória da sincronização (ver accountSync.ts). Nome do arquivo
// diferente do accounts.json, que é das contas do Claude.

export type AccountFile = {
  profile: AccountProfile | null
  // De onde veio a foto: igual na próxima leitura do perfil, não baixa de novo.
  avatarUrl: string | null
  // Entrou e a primeira rodada (a que traz as da conta) ainda não terminou: a próxima é ela.
  adoptPending: boolean
  memory: SyncMemory
  // Hash do último desenho dos workspaces enviado à conta (manda só quando muda).
  workspacesSent: string | null
  // Arquivos do Claude que estavam iguais aqui e na conta da última vez (ver accountClaude.ts).
  claudeKnown: Hashes
};

const file = () => join(app.getPath('userData'), 'argus-account.json');

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);
const isProvider = (v: unknown): v is AccountProvider => ACCOUNT_PROVIDERS.includes(v as AccountProvider);

function identitiesOf(raw: unknown): AccountIdentity[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r: { provider?: unknown; login?: unknown; email?: unknown }) =>
    r && isProvider(r.provider) ? [{ provider: r.provider, login: text(r.login, 100), email: text(r.email, 320) }] : [],
  );
}

// Perfil vindo do servidor ({ id, name, email, avatarUrl, identities }) ou do arquivo ({ ..., avatar }).
export function readProfile(raw: unknown, avatar?: string | null): AccountProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const id = text(p.id, 100);
  if (!id) return null;
  const saved = typeof p.avatar === 'string' && p.avatar.startsWith('data:image/') ? p.avatar : null;
  return {
    id,
    name: text(p.name, 200) || 'Argus',
    email: text(p.email, 320),
    avatar: avatar === undefined ? saved : avatar,
    identities: identitiesOf(p.identities),
  };
}

// Lista de aparelhos vinda do servidor; nula se não veio no formato.
export function readDevices(raw: unknown): AccountDevice[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((d: Record<string, unknown> | null) => {
    const id = d ? text(d.id, 100) : null;
    if (!d || !id) return [];
    const lastSeenAt = typeof d.lastSeenAt === 'number' ? d.lastSeenAt : 0;
    return [{ id, name: text(d.name, 100) || 'Argus', platform: text(d.platform, 20) || 'other', lastSeenAt, current: d.current === true }];
  });
}

export function loadAccountFile(): AccountFile {
  const r = readJsonFile<Partial<Record<keyof AccountFile, unknown>>>(file());
  const data = r.status === 'ok' && r.data && typeof r.data === 'object' ? r.data : {};
  return {
    profile: readProfile(data.profile),
    avatarUrl: text(data.avatarUrl, 2000),
    adoptPending: data.adoptPending === true,
    memory: normalizeMemory(data.memory),
    workspacesSent: text(data.workspacesSent, 100),
    claudeKnown: readHashes(data.claudeKnown),
  };
}

function readHashes(raw: unknown): Hashes {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Hashes = {};
  for (const [path, hash] of Object.entries(raw)) if (typeof hash === 'string') out[path] = hash;
  return out;
}

export function saveAccountFile(data: AccountFile): void {
  try {
    writeJsonAtomicSync(file(), data);
  } catch (err) {
    console.warn('[account] não deu para gravar o arquivo da conta:', err);
  }
}
