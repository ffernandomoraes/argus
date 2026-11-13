// O que as telas já leram do Argus de casa, guardado na memória e no aparelho: o app abre já com a
// última versão e atualiza por baixo quando a resposta nova chega. Cuidados:
// - separado por computador (hostId) e por versão do app (formato pode mudar entre versões);
// - o que mudaria a decisão de quem olha se estivesse velho (conversas trabalhando agora) não vai
//   para o aparelho (ver EPHEMERAL), só fica na memória;
// - cada valor tem teto de tamanho, os históricos de conversa ficam só os HISTORY_LIMIT mais
//   recentes, e armazenamento cheio limpa o que é deste app e segue sem guardar.

const ROOT = 'argus-cache:';
const PREFIX = `${ROOT}${__APP_VERSION__}:`;
const EPHEMERAL = new Set(['active', 'interrupted']);
const MAX_VALUE = 400_000;
const HISTORY_LIMIT = 20;

type Entry = { t: number; v: unknown };

const memory = new Map<string, unknown>();
let scope = '';

const storageKey = (key: string) => `${PREFIX}${scope}:${key}`;

function ownKeys(prefix = ROOT): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) out.push(k);
    }
  } catch {
    // sem armazenamento
  }
  return out;
}

function removeAll(keys: string[]): void {
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      // nada
    }
  }
}

// O computador pareado: troca de escopo e apaga o que for de versões antigas do app.
export function setCacheScope(hostId: string): void {
  if (scope === hostId) return;
  scope = hostId;
  memory.clear();
  removeAll(ownKeys().filter((k) => !k.startsWith(PREFIX)));
}

// Esquecer o computador: nada dele fica no aparelho.
export function clearCache(): void {
  memory.clear();
  removeAll(ownKeys());
}

export function cacheGet<T>(key: string): T | undefined {
  if (memory.has(key)) return memory.get(key) as T;
  if (!scope || EPHEMERAL.has(key)) return undefined;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return undefined;
    const value = (JSON.parse(raw) as Entry).v as T;
    memory.set(key, value);
    return value;
  } catch {
    return undefined;
  }
}

// Gravações no aparelho juntas, um instante depois (várias respostas chegam de uma vez).
const dirty = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function cacheSet(key: string, value: unknown): void {
  memory.set(key, value);
  if (!scope || EPHEMERAL.has(key)) return;
  dirty.add(key);
  timer ??= setTimeout(flush, 500);
}

function flush(): void {
  timer = null;
  const keys = [...dirty];
  dirty.clear();
  for (const key of keys) {
    let text: string;
    try {
      text = JSON.stringify({ t: Date.now(), v: memory.get(key) } satisfies Entry);
    } catch {
      continue;
    }
    if (text.length > MAX_VALUE) {
      removeAll([storageKey(key)]);
      continue;
    }
    try {
      localStorage.setItem(storageKey(key), text);
    } catch {
      // Cheio: limpa o que é deste app e segue só com a memória.
      removeAll(ownKeys());
      return;
    }
  }
  trimHistories();
}

// Só os históricos das conversas abertas mais recentemente ficam no aparelho.
function trimHistories(): void {
  const keys = ownKeys(`${PREFIX}${scope}:history:`);
  if (keys.length <= HISTORY_LIMIT) return;
  const aged = keys.map((k) => {
    try {
      return { k, t: (JSON.parse(localStorage.getItem(k) ?? '{}') as Entry).t ?? 0 };
    } catch {
      return { k, t: 0 };
    }
  });
  aged.sort((a, b) => b.t - a.t);
  removeAll(aged.slice(HISTORY_LIMIT).map((a) => a.k));
}
