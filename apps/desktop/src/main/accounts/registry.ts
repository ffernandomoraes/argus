import { followMerged, MAIN_ACCOUNT, type LoginIdentity, type LoginMethod } from '@argus/shared/auth';
import { errorMessage } from '../lib/errors';
import { quarantine, readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile';
import { ID, registryFile } from './paths';

// A lista de contas do app (accounts.json, na pasta de dados): quais existem além da principal, os
// apelidos, a padrão e como cada uma entrou da última vez.

type Registry = {
  // Só as que não são a principal, na ordem em que entraram.
  accounts: string[]
  // Apelidos escolhidos, inclusive o da principal.
  names: Record<string, string>
  defaultId: string
  // Como cada conta entrou da última vez (assinatura do Claude ou Console), inclusive a principal:
  // com o login perdido, o "Entrar" abre o navegador direto nesse jeito, sem perguntar. Sai quando a
  // pessoa sai da conta pelo app: aí o login não se perdeu, e a conta não aparece como sem login.
  methods: Record<string, LoginMethod>
  // Contas que saíram da lista por terem o mesmo login de outra, e a que ficou no lugar de cada uma
  // (ver mergeAccount): grupo e conversa que guardavam a removida passam a usar a que ficou.
  merged: Record<string, string>
  // Pastas de contas juntadas, apagadas na próxima abertura do app (ver erase.ts): na hora, uma
  // conversa ou um terminal ainda podem estar rodando com o login de lá.
  trash: string[]
  // De quem era o último login de cada conta (identificadores fixos da conta do Claude; ver
  // LoginIdentity), inclusive a principal. Fica depois de o login cair: é como o app reconhece que
  // uma conta "nova" é a mesma que está na lista sem login. Sai quando a pessoa sai da conta pelo app.
  identities: Record<string, LoginIdentity>
  // Quando o app viu cada conta perder o login (ms), até ela aparecer logada de novo: a perda vai ao
  // Sentry uma vez só, e não a cada abertura com a conta ainda sem login.
  lost: Record<string, number>
};

let registry: Registry | null = null;
// O accounts.json foi lido (ou ainda não existia)? Ilegível, ele não diz quais contas existem: nada
// de apagar pasta de conta nesta abertura (ver erase.ts).
let readable = true;
// Contas novas esperando o login terminar: já têm pasta, mas ainda não entram na lista.
export const pending = new Set<string>();

const empty = (): Registry => ({ accounts: [], names: {}, defaultId: MAIN_ACCOUNT, methods: {}, merged: {}, trash: [], identities: {}, lost: {} });

const isMethod = (v: unknown): v is LoginMethod => v === 'claudeai' || v === 'console';

// Só o formato esperado: ids de 8 caracteres e apelidos em texto. O resto é ignorado.
function validate(saved: unknown): Registry {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof Registry, unknown>>;
  const accounts = Array.isArray(s.accounts)
    ? [...new Set(s.accounts.filter((id): id is string => typeof id === 'string' && ID.test(id)))]
    : [];
  const names =
    s.names && typeof s.names === 'object'
      ? Object.fromEntries(Object.entries(s.names).filter((e): e is [string, string] => typeof e[1] === 'string'))
      : {};
  const methods =
    s.methods && typeof s.methods === 'object'
      ? Object.fromEntries(Object.entries(s.methods).filter((e): e is [string, LoginMethod] => isMethod(e[1])))
      : {};
  const isAccount = (v: unknown): v is string => typeof v === 'string' && (v === MAIN_ACCOUNT || ID.test(v));
  const merged =
    s.merged && typeof s.merged === 'object'
      ? Object.fromEntries(Object.entries(s.merged).filter((e): e is [string, string] => ID.test(e[0]) && isAccount(e[1]) && e[0] !== e[1]))
      : {};
  const trash = Array.isArray(s.trash) ? [...new Set(s.trash.filter((id): id is string => typeof id === 'string' && ID.test(id)))] : [];
  const identities =
    s.identities && typeof s.identities === 'object'
      ? Object.fromEntries(Object.entries(s.identities).flatMap(([id, v]) => (validIdentity(v) ? [[id, validIdentity(v)!]] : [])))
      : {};
  const lost =
    s.lost && typeof s.lost === 'object'
      ? Object.fromEntries(Object.entries(s.lost).filter((e): e is [string, number] => typeof e[1] === 'number'))
      : {};
  return { accounts, names, defaultId: typeof s.defaultId === 'string' ? s.defaultId : MAIN_ACCOUNT, methods, merged, trash, identities, lost };
}

// Só os campos de texto esperados; nada se não sobra o que identifique.
function validIdentity(v: unknown): LoginIdentity | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const identity: LoginIdentity = {};
  for (const key of ['accountUuid', 'organizationId', 'email', 'organization'] as const) if (typeof o[key] === 'string' && o[key]) identity[key] = o[key];
  return identity.accountUuid || identity.email ? identity : null;
}

export function reg(): Registry {
  if (registry) return registry;
  const file = registryFile();
  const read = readJsonFile(file);
  if (read.status === 'ok') registry = validate(read.data);
  else {
    if (read.status === 'corrupt') {
      readable = false;
      // O arquivo ilegível vai para o lado, com a data, para as contas darem para ser recuperadas à
      // mão. A lista começa vazia e a próxima gravação cria um novo.
      console.error('[accounts] accounts.json ilegível:', read.error, '- guardado em', quarantine(file));
    }
    registry = empty();
  }
  return registry;
}

// false quando o accounts.json desta abertura não pôde ser lido.
export function registryReadable(): boolean {
  reg();
  return readable;
}

function save(): void {
  try {
    writeJsonAtomicSync(registryFile(), reg());
  } catch (err) {
    // Sem gravar, vale só até fechar o app.
    console.error('[accounts] não deu para gravar o accounts.json:', errorMessage(err));
  }
}

// A principal primeiro, depois as outras na ordem em que entraram.
export function accountIds(): string[] {
  return [MAIN_ACCOUNT, ...reg().accounts];
}

export function defaultAccount(): string {
  const { accounts, defaultId } = reg();
  return accounts.includes(defaultId) ? defaultId : MAIN_ACCOUNT;
}

// A conta pedida, se ela existe (ou está entrando agora); a que ficou no lugar dela, se foi juntada
// a outra (ver mergeAccount); senão, a padrão. Grupo com conta que foi removida cai aqui.
export function resolveAccount(id?: string): string {
  const exists = (a: string) => a === MAIN_ACCOUNT || reg().accounts.includes(a) || pending.has(a);
  if (!id) return defaultAccount();
  if (exists(id)) return id;
  const kept = followMerged(reg().merged, id);
  return exists(kept) ? kept : defaultAccount();
}

// Contas juntadas e a que ficou no lugar de cada uma, para a tela resolver do mesmo jeito.
export function mergedAccounts(): Record<string, string> {
  return reg().merged;
}

export function customName(id: string): string | undefined {
  return reg().names[id];
}

export function addAccount(id: string): void {
  pending.delete(id);
  const r = reg();
  if (!r.accounts.includes(id)) r.accounts.push(id);
  save();
}

// Tira a conta da lista (a pasta é com quem chamou). Grupos que usavam ela passam a usar a padrão.
export function forgetAccount(id: string): void {
  const r = reg();
  r.accounts = r.accounts.filter((a) => a !== id);
  delete r.names[id];
  delete r.methods[id];
  delete r.identities[id];
  delete r.lost[id];
  // Quem tinha sido juntada a ela volta a não ter conta (vale a padrão).
  for (const [from, into] of Object.entries(r.merged)) if (into === id || from === id) delete r.merged[from];
  if (r.defaultId === id) r.defaultId = MAIN_ACCOUNT;
  save();
}

// Duas contas do app com o mesmo login do Claude viram uma: `removed` sai da lista e `into` fica no
// lugar dela (nos grupos, nas conversas e como padrão, se era ela). A pasta de `removed` é apagada
// na próxima abertura (ver Registry.trash). A principal nunca sai.
export function mergeAccount(removed: string, into: string): void {
  const r = reg();
  if (removed === MAIN_ACCOUNT || removed === into || !r.accounts.includes(removed)) return;
  r.accounts = r.accounts.filter((a) => a !== removed);
  delete r.names[removed];
  delete r.methods[removed];
  delete r.identities[removed];
  delete r.lost[removed];
  for (const [from, target] of Object.entries(r.merged)) if (target === removed) r.merged[from] = into;
  delete r.merged[into];
  r.merged[removed] = into;
  if (!r.trash.includes(removed)) r.trash.push(removed);
  if (r.defaultId === removed) r.defaultId = into;
  save();
}

// Pastas de contas juntadas à espera de serem apagadas (ver Registry.trash).
export function trashedAccounts(): string[] {
  return [...reg().trash];
}

export function clearTrashedAccounts(): void {
  const r = reg();
  if (!r.trash.length) return;
  r.trash = [];
  save();
}

// O app viu a conta sem login. true na primeira vez desde que ela esteve logada (ver Registry.lost).
export function markLoginLost(id: string, now: number): boolean {
  const r = reg();
  if (id in r.lost) return false;
  r.lost[id] = now;
  save();
  return true;
}

// A conta apareceu logada: a próxima perda conta de novo.
export function clearLoginLost(id: string): void {
  const r = reg();
  if (!(id in r.lost)) return;
  delete r.lost[id];
  save();
}

// Como a conta entrou da última vez (ver Registry.methods); nada se o app ainda não viu ela logada.
export function loginMethod(id: string): LoginMethod | undefined {
  return reg().methods[id];
}

// Grava só o que mudou: chamado a cada conferência de login.
export function rememberLoginMethod(id: string, method: LoginMethod): void {
  const r = reg();
  if (r.methods[id] === method) return;
  r.methods[id] = method;
  save();
}

// A pessoa saiu da conta pelo app (ver Registry.methods): o jeito de entrar e de quem era o login
// saem juntos.
export function forgetLoginMethod(id: string): void {
  const r = reg();
  if (!(id in r.methods) && !(id in r.identities)) return;
  delete r.methods[id];
  delete r.identities[id];
  save();
}

// De quem era o último login da conta (ver Registry.identities).
export function lastIdentity(id: string): LoginIdentity | undefined {
  return reg().identities[id];
}

// Grava só o que mudou: chamado a cada conferência de login.
export function rememberIdentity(id: string, identity: LoginIdentity): void {
  const r = reg();
  const old = r.identities[id];
  const keys = ['accountUuid', 'organizationId', 'email', 'organization'] as const;
  if (old && keys.every((k) => old[k] === identity[k])) return;
  r.identities[id] = identity;
  save();
}

// Vazio volta para o nome sugerido.
export function renameAccount(id: string, name: string): void {
  const r = reg();
  const clean = name.trim().slice(0, 40);
  if (clean) r.names[id] = clean;
  else delete r.names[id];
  save();
}

export function setDefaultAccount(id: string): void {
  const r = reg();
  if (id !== MAIN_ACCOUNT && !r.accounts.includes(id)) return;
  r.defaultId = id;
  save();
}
