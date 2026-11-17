import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Fora de repositório git não há .gitignore para dizer o que é gerado: estas pastas ficam de fora
// da busca (dependências, saídas de build, caches), além dos arquivos que o sistema cria sozinho.
const SKIP = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'bower_components',
  'dist',
  'out',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'target',
  '__pycache__',
  '.venv',
  'venv',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
]);

// Arquivos de uma pasta e das de dentro, relativos a ela com "/", nível por nível (os de cima
// primeiro). Para no limite (truncated) ou quando a busca é cancelada. Atalhos não são seguidos.
export async function walkFiles(base: string, limit: number, signal?: AbortSignal): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  const queue = [''];
  for (let i = 0; i < queue.length; i++) {
    if (signal?.aborted) break;
    const rel = queue[i];
    const entries = await readdir(rel ? join(base, rel) : base, { withFileTypes: true }).catch(() => []);
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) queue.push(path);
      else if (e.isFile()) {
        files.push(path);
        if (files.length >= limit) return { files, truncated: true };
      }
    }
  }
  return { files, truncated: false };
}
