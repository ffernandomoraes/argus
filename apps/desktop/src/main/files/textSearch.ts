import { open } from 'node:fs/promises';
import { join } from 'node:path';
import type { TextSearchFile, TextSearchOptions, TextSearchResult } from '@argus/shared/files';
import { insideRoot } from '../paths';
import { gitGrep } from './gitGrep';
import { lineSnippet, searchPattern } from './searchPattern';
import { walkFiles } from './walk';

// Linhas devolvidas por busca: mais que isso a lista fica pesada e ninguém lê.
const MAX_MATCHES = 2000;
// Fora do git: quantos arquivos ler, o tamanho máximo de cada um e quantos ao mesmo tempo.
const MAX_SCAN_FILES = 20_000;
const MAX_SCAN_BYTES = 1024 * 1024;
const PARALLEL = 16;

// Uma busca por quem pediu (cada janela, ou a janela remota): a nova cancela a anterior, que
// ficaria rodando à toa a cada tecla.
const running = new WeakMap<object, AbortController>();

// Junta as linhas por arquivo, na ordem em que chegam, até o limite.
function collector() {
  const files = new Map<string, TextSearchFile>();
  let total = 0;
  return {
    add(path: string, match: TextSearchFile['matches'][number]): boolean {
      let file = files.get(path);
      if (!file) files.set(path, (file = { path, matches: [] }));
      file.matches.push(match);
      return ++total < MAX_MATCHES;
    },
    result: (truncated: boolean): TextSearchResult => ({ ok: true, files: [...files.values()], total, truncated }),
  };
}

// Texto de um arquivo, se for pequeno e não for binário (tem byte zero no começo).
async function readText(path: string): Promise<string | null> {
  const handle = await open(path, 'r').catch(() => null);
  if (!handle) return null;
  try {
    const { size } = await handle.stat();
    if (size > MAX_SCAN_BYTES) return null;
    const buf = Buffer.alloc(size);
    await handle.read(buf, 0, size, 0);
    return buf.subarray(0, 8000).includes(0) ? null : buf.toString('utf8');
  } catch {
    return null;
  } finally {
    await handle.close().catch(() => {});
  }
}

// Busca sem git: percorre a pasta e lê arquivo por arquivo.
async function scanFiles(base: string, pattern: RegExp, signal: AbortSignal): Promise<TextSearchResult> {
  const { files, truncated: tooMany } = await walkFiles(base, MAX_SCAN_FILES, signal);
  const out = collector();
  for (let i = 0; i < files.length; i += PARALLEL) {
    if (signal.aborted) return out.result(true);
    const batch = files.slice(i, i + PARALLEL);
    const texts = await Promise.all(batch.map((rel) => readText(join(base, rel))));
    for (let k = 0; k < batch.length; k++) {
      const text = texts[k];
      if (text === null) continue;
      const lines = text.split('\n');
      for (let n = 0; n < lines.length; n++) {
        pattern.lastIndex = 0;
        if (!pattern.test(lines[n])) continue;
        if (!out.add(batch[k], lineSnippet(n + 1, lines[n], pattern))) return out.result(true);
      }
    }
  }
  return out.result(tooMany);
}

// Busca o texto nos arquivos do projeto (como o ⌘⇧F do VS Code). No git, pelo `git grep` (respeita o
// .gitignore); fora dele, lendo os arquivos.
export async function searchText(owner: object, root: string, query: string, opts: TextSearchOptions): Promise<TextSearchResult> {
  running.get(owner)?.abort();
  const ctrl = new AbortController();
  running.set(owner, ctrl);
  try {
    const base = insideRoot(root, '');
    if (!base || !query) return { ok: true, files: [], total: 0, truncated: false };
    const pattern = searchPattern(query, opts);
    if (!(pattern instanceof RegExp)) return { ok: false, error: pattern.error };
    const out = collector();
    const grep = await gitGrep(base, query, opts, {
      onLine: (hit) => out.add(hit.path, lineSnippet(hit.line, hit.text, pattern)),
      signal: ctrl.signal,
    });
    if (ctrl.signal.aborted) return { ok: false, error: 'cancelled', cancelled: true };
    if (grep.kind === 'done') return out.result(grep.truncated);
    if (grep.kind === 'error') return { ok: false, error: grep.message };
    const scanned = await scanFiles(base, pattern, ctrl.signal);
    return ctrl.signal.aborted ? { ok: false, error: 'cancelled', cancelled: true } : scanned;
  } finally {
    if (running.get(owner) === ctrl) running.delete(owner);
  }
}
