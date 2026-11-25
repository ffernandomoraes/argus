import { gitRemote, scanGitFolders } from './account/folderSearch';
import { expandHome } from './paths';
import { listKnownFolders } from './sessions/knownFolders';

// Os repositórios que já estão clonados neste computador, para o "Clonar do GitHub" marcar (e abrir
// a pasta em vez de clonar de novo): o origin do git das pastas com conversa do Claude e das achadas
// na busca rápida da pasta do usuário (até 4 níveis, 4 segundos), comparado pelo endereço
// normalizado ("github.com/dono/nome"). Guarda por um minuto: a janela abre e fecha várias vezes.

const CACHE_MS = 60_000;
let cache: { at: number; clones: Promise<Record<string, string>> } | null = null;

async function find(): Promise<Record<string, string>> {
  const [known, scanned] = await Promise.all([listKnownFolders().catch(() => []), scanGitFolders().catch(() => [])]);
  const dirs = [...new Set([...known.map((f) => expandHome(f.path)), ...scanned])];
  const remotes = await Promise.all(dirs.map((dir) => gitRemote(dir).catch(() => null)));
  const out: Record<string, string> = {};
  // O primeiro achado vale: as pastas com conversa vêm antes.
  remotes.forEach((remote, i) => {
    if (remote && !out[remote]) out[remote] = dirs[i]!;
  });
  return out;
}

export function localClones(): Promise<Record<string, string>> {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), clones: find() };
  return cache.clones;
}

// Clonou agora: a próxima consulta busca de novo.
export function forgetLocalClones(): void {
  cache = null;
}
