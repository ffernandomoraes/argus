// Sincronização das preferências com a conta do Argus (ver account.ts). Funções puras: quem lê e
// aplica os valores é o processo principal (as dele) e a janela (as dela, que ficam no localStorage).
//
// Regras (decididas em 2026-11-23):
// - vence a última alteração que chega ao servidor, preferência por preferência (não o arquivo todo);
// - na primeira entrada de um computador, as da conta vencem; as que a conta ainda não tem vão daqui;
// - ficam em cada computador: zoom, conversas favoritas e o que é da máquina.

export const RENDERER_SYNC_KEYS = [
  'theme',
  'openIn',
  'conversation',
  'mediaPlayer',
  'promptSuggestions',
  'pinNewDrawers',
] as const;

export const MAIN_SYNC_KEYS = ['language', 'notifications', 'notificationSound', 'menuBarIcon', 'storage'] as const;

export type RendererSyncKey = (typeof RENDERER_SYNC_KEYS)[number];
export type MainSyncKey = (typeof MAIN_SYNC_KEYS)[number];
export type SyncKey = RendererSyncKey | MainSyncKey;
export type RendererSyncValues = Partial<Record<RendererSyncKey, unknown>>;
export type MainSyncValues = Partial<Record<MainSyncKey, unknown>>;
export type SyncValues = Partial<Record<SyncKey, unknown>>;

const ALL_KEYS: readonly string[] = [...RENDERER_SYNC_KEYS, ...MAIN_SYNC_KEYS];
const PREFIX = 'pref.';

export const serverKey = (k: SyncKey): string => PREFIX + k;

// Nulo: chave de outra versão do app (ou que não é preferência): fica no servidor, sem uso aqui.
export function localKey(server: string): SyncKey | null {
  const k = server.startsWith(PREFIX) ? server.slice(PREFIX.length) : '';
  return ALL_KEYS.includes(k) ? (k as SyncKey) : null;
}

export const isRendererKey = (k: string): k is RendererSyncKey => (RENDERER_SYNC_KEYS as readonly string[]).includes(k);
export const isMainKey = (k: string): k is MainSyncKey => (MAIN_SYNC_KEYS as readonly string[]).includes(k);

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  }
  return v;
}

// Texto estável de um valor (chaves em ordem): o mesmo objeto montado em outra ordem não parece mudado.
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value ?? null));
}

const parse = (text: string): unknown => JSON.parse(text) as unknown;

export type SyncMemory = {
  // Última versão do servidor já aplicada aqui.
  cursor: number
  // O último valor combinado com o servidor, de cada preferência (canonical).
  synced: Partial<Record<SyncKey, string>>
  // Mudaram aqui e ainda não foram para o servidor.
  dirty: SyncKey[]
  // O último valor que a janela contou de cada preferência dela (canonical). Separa "mudou na
  // janela" (vai para a conta) de "a conta mudou com a janela fechada" (vai para a janela).
  rendererSeen: Partial<Record<RendererSyncKey, string>>
};

export const emptyMemory = (rendererSeen: SyncMemory['rendererSeen'] = {}): SyncMemory => ({ cursor: 0, synced: {}, dirty: [], rendererSeen });

// Memória lida do disco, sem confiar no formato.
export function normalizeMemory(raw: unknown): SyncMemory {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof SyncMemory, unknown>>;
  const texts = <K extends string>(v: unknown, ok: (k: string) => k is K): Partial<Record<K, string>> =>
    v && typeof v === 'object'
      ? (Object.fromEntries(Object.entries(v).filter(([k, t]) => ok(k) && typeof t === 'string')) as Partial<Record<K, string>>)
      : {};
  const isSyncKey = (k: string): k is SyncKey => ALL_KEYS.includes(k);
  return {
    cursor: typeof m.cursor === 'number' && Number.isInteger(m.cursor) && m.cursor >= 0 ? m.cursor : 0,
    synced: texts(m.synced, isSyncKey),
    dirty: Array.isArray(m.dirty) ? [...new Set(m.dirty.filter((k): k is SyncKey => typeof k === 'string' && isSyncKey(k)))] : [],
    rendererSeen: texts(m.rendererSeen, isRendererKey),
  };
}

const withoutKey = <T>(list: T[], key: T) => list.filter((k) => k !== key);

// O que veio do servidor: o que aplicar aqui e a memória nova. Fora da primeira entrada, a
// preferência mudada aqui e ainda não enviada fica (vai no próximo envio e vence por chegar depois).
// adopt (primeira entrada deste computador): as da conta vencem mesmo as mudadas aqui.
export function planPull(
  memory: SyncMemory,
  items: { key: string; value: unknown }[],
  version: number,
  adopt: boolean,
): { apply: SyncValues; memory: SyncMemory } {
  const apply: SyncValues = {};
  const synced = { ...memory.synced };
  let dirty = [...memory.dirty];
  for (const item of items) {
    const k = localKey(item.key);
    if (!k || (!adopt && dirty.includes(k))) continue;
    apply[k] = item.value;
    synced[k] = canonical(item.value);
    dirty = withoutKey(dirty, k);
  }
  return { apply, memory: { ...memory, cursor: Math.max(memory.cursor, version), synced, dirty } };
}

// Valores daqui (os do processo principal de agora, ou os editados na janela): os diferentes do
// combinado ficam pendentes.
export function markDirty(memory: SyncMemory, local: SyncValues): SyncMemory {
  const dirty = new Set(memory.dirty);
  for (const [k, v] of Object.entries(local) as [SyncKey, unknown][]) {
    if (canonical(v) !== memory.synced[k]) dirty.add(k);
  }
  return dirty.size === memory.dirty.length ? memory : { ...memory, dirty: [...dirty] };
}

// A janela contou as preferências dela. edited: mudaram desde a última vez (mudança feita aqui);
// toApply: a conta tem outro valor que a janela ainda não recebeu (chegou com ela fechada).
export function readReport(
  memory: SyncMemory,
  report: RendererSyncValues,
): { memory: SyncMemory; edited: RendererSyncValues; toApply: RendererSyncValues } {
  const edited: RendererSyncValues = {};
  const toApply: RendererSyncValues = {};
  const rendererSeen = { ...memory.rendererSeen };
  for (const [k, v] of Object.entries(report) as [RendererSyncKey, unknown][]) {
    if (!isRendererKey(k) || v === undefined) continue;
    const text = canonical(v);
    if (text !== rendererSeen[k]) {
      edited[k] = v;
      rendererSeen[k] = text;
      continue;
    }
    const synced = memory.synced[k];
    if (synced !== undefined && synced !== text && !memory.dirty.includes(k)) toApply[k] = parse(synced);
  }
  return { memory: { ...memory, rendererSeen }, edited, toApply };
}

// As preferências da janela pelo último valor que ela contou.
export function rendererValues(memory: SyncMemory): RendererSyncValues {
  const out: RendererSyncValues = {};
  for (const [k, text] of Object.entries(memory.rendererSeen) as [RendererSyncKey, string][]) out[k] = parse(text);
  return out;
}

// As que a conta ainda não tem (nunca combinadas), com o valor daqui: vão no primeiro envio.
export function missingOnServer(memory: SyncMemory, local: SyncValues): SyncValues {
  const out: SyncValues = {};
  for (const [k, v] of Object.entries(local) as [SyncKey, unknown][]) {
    if (memory.synced[k] === undefined && v !== undefined) out[k] = v;
  }
  return out;
}

// As pendentes, com o valor de agora (some a que não tem valor aqui).
export function pendingValues(memory: SyncMemory, current: SyncValues): SyncValues {
  const out: SyncValues = {};
  for (const k of memory.dirty) if (current[k] !== undefined) out[k] = current[k];
  return out;
}

// Envio aceito: o enviado vira o combinado. Mudada de novo durante o envio, continua pendente.
export function afterPush(memory: SyncMemory, sent: SyncValues, current: SyncValues): SyncMemory {
  const synced = { ...memory.synced };
  let dirty = [...memory.dirty];
  for (const [k, v] of Object.entries(sent) as [SyncKey, unknown][]) {
    synced[k] = canonical(v);
    if (canonical(current[k]) === synced[k]) dirty = withoutKey(dirty, k);
  }
  return { ...memory, synced, dirty };
}
