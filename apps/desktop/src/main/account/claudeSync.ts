import {
  filesOfItem,
  isAgentFilePath,
  MAX_CLAUDE_FILE_BYTES,
  planClaude,
  splitAgentPath,
  type ClaudeAction,
  type ClaudeItem,
  type Hashes,
} from '@argus/shared/accountClaude';
import { claudeHash, scanClaudeFiles, writeClaudeFile, type LocalFile } from './claudeFiles';
import { AccountHttpError } from './http';

// CLAUDE.md, skills, agentes e comandos na conta (item 1f). A cada rodada: o que mudou só aqui vai
// para a conta sozinho; o que chegou de outro computador fica na lista do Perfil até a pessoa
// importar (ou escolher, quando os dois mudaram). Regras em packages/shared/src/accountClaude.ts.

type Request = <T>(path: string, method?: 'GET' | 'PUT' | 'POST', body?: unknown) => Promise<T | null>;

// Cada envio leva no máximo isto (o servidor aceita até 3 MB por pedido).
const BATCH_BYTES = 1_500_000;
const BATCH_FILES = 150;

// O arquivo que chegou da conta, se puder ser gravado: pedido neste import, caminho aceito, texto
// dentro do limite e com o mesmo hash da lista da conta. Nulo: fica de fora (um servidor com
// defeito, ou alguém com a sessão da conta, não grava outro arquivo nem troca o conteúdo).
export function importable(raw: unknown, wanted: ReadonlySet<string>, remote: Hashes): { path: string; content: string; hash: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { path, content } = raw as { path?: unknown; content?: unknown };
  if (typeof path !== 'string' || typeof content !== 'string' || !wanted.has(path) || !isAgentFilePath(path)) return null;
  if (content.includes('\u0000') || Buffer.byteLength(content, 'utf8') > MAX_CLAUDE_FILE_BYTES) return null;
  const hash = remote[path];
  return hash && claudeHash(content) === hash ? { path, content, hash } : null;
}

export class ClaudeLibrary {
  private last: ClaudeItem[] | null = null;

  constructor(
    private readonly request: Request,
    // O que estava igual aqui e na conta da última vez (guardado no arquivo da conta).
    private readonly memory: { get(): Hashes; set(known: Hashes): void },
  ) {}

  items(): ClaudeItem[] | null {
    return this.last;
  }

  forget(): void {
    this.last = null;
  }

  // Compara, manda o que mudou só aqui e devolve a lista do Perfil.
  async refresh(): Promise<ClaudeItem[]> {
    const [local, remote] = await Promise.all([scanClaudeFiles(), this.remote()]);
    const before = this.memory.get();
    const plan = planClaude(hashes(local), remote, before);
    const sent = new Set(await this.upload(plan.upload, local));
    // O que não coube (ou o servidor recusou) continua como antes: tenta de novo quando mudar ou sobrar
    // espaço. E não aparece na lista como se estivesse na conta.
    const unsent = new Set(plan.upload.filter((p) => !sent.has(p)));
    for (const p of unsent) restore(plan.known, before, p);
    const all = [...new Set([...local.keys(), ...Object.keys(remote)])];
    const items = plan.items.filter((i) => !filesOfItem(i.key, all).every((p) => unsent.has(p)));
    this.memory.set(plan.known);
    this.last = items;
    return items;
  }

  // Importar (a versão da conta vem para cá), manter a daqui (vai para a conta) ou tirar da conta.
  async act(action: ClaudeAction, keys: string[]): Promise<ClaudeItem[]> {
    const [local, remote] = await Promise.all([scanClaudeFiles(), this.remote()]);
    const known = { ...this.memory.get() };
    const remotePaths = keys.flatMap((k) => filesOfItem(k, Object.keys(remote)));
    if (action === 'import') {
      if (remotePaths.length) await this.importFiles(remotePaths, remote, known);
    } else if (action === 'keepLocal') {
      const mine = keys.flatMap((k) => filesOfItem(k, local.keys())).filter((p) => local.get(p)?.hash !== remote[p]);
      for (const p of await this.upload(mine, local)) known[p] = local.get(p)?.hash ?? known[p]!;
    } else if (remotePaths.length) {
      await this.request('/api/claude/remove', 'POST', { paths: remotePaths });
      // Fica a lembrança de "estava igual": o arquivo daqui não volta sozinho para a conta.
      for (const p of remotePaths) if (local.get(p)?.hash === remote[p]) known[p] = remote[p]!;
    }
    this.memory.set(known);
    return this.refresh();
  }

  // Grava o que veio da conta para os caminhos pedidos (ver importable). O recusado não é gravado e
  // continua na lista do Perfil como antes.
  private async importFiles(paths: string[], remote: Hashes, known: Hashes): Promise<void> {
    const wanted = new Set(paths);
    const r = await this.request<{ files?: unknown }>('/api/claude/read', 'POST', { paths });
    let refused = 0;
    for (const raw of Array.isArray(r?.files) ? (r.files as unknown[]) : []) {
      const file = importable(raw, wanted, remote);
      if (!file) {
        refused++;
        continue;
      }
      wanted.delete(file.path);
      await writeClaudeFile(file.path, file.content);
      known[file.path] = file.hash;
    }
    if (refused) console.warn(`[account] importar: ${refused} arquivo(s) recusado(s): não pedidos ou diferentes da lista da conta`);
  }

  // Os arquivos da conta, com o hash de cada um.
  private async remote(): Promise<Hashes> {
    const r = await this.request<{ files?: { path?: unknown; hash?: unknown }[] }>('/api/claude');
    const files: Hashes = {};
    for (const f of r?.files ?? []) if (typeof f.path === 'string' && typeof f.hash === 'string') files[f.path] = f.hash;
    return files;
  }

  // Manda em lotes, separados por provedor, e devolve o que foi. A conta cheia (413) para o envio; o
  // servidor recusando os arquivos de um provedor (400, por exemplo um servidor mais antigo que o
  // app) deixa só aquele de fora. Nos dois casos a rodada segue.
  private async upload(paths: string[], local: Map<string, LocalFile>): Promise<string[]> {
    const sent: string[] = [];
    const bySource = new Map<string, string[]>();
    for (const path of paths) {
      const source = splitAgentPath(path)?.source ?? 'claude';
      bySource.set(source, [...(bySource.get(source) ?? []), path]);
    }
    for (const [source, group] of bySource) {
      const result = await this.uploadGroup(group, local, sent);
      if (result === 'full') break;
      if (result === 'refused') console.warn(`[account] o servidor recusou as instruções e skills de ${source}`);
    }
    return sent;
  }

  private async uploadGroup(paths: string[], local: Map<string, LocalFile>, sent: string[]): Promise<'ok' | 'full' | 'refused'> {
    let batch: { path: string; content: string }[] = [];
    let bytes = 0;
    const flush = async (): Promise<'ok' | 'full' | 'refused'> => {
      if (!batch.length) return 'ok';
      try {
        await this.request('/api/claude', 'PUT', { files: batch });
      } catch (err) {
        if (err instanceof AccountHttpError && err.status === 413) {
          console.warn('[account] instruções e skills passaram do limite da conta');
          return 'full';
        }
        if (err instanceof AccountHttpError && err.status === 400) return 'refused';
        throw err;
      }
      sent.push(...batch.map((f) => f.path));
      batch = [];
      bytes = 0;
      return 'ok';
    };
    for (const path of paths) {
      const file = local.get(path);
      if (!file) continue;
      const size = Buffer.byteLength(file.content, 'utf8');
      if (batch.length >= BATCH_FILES || bytes + size > BATCH_BYTES) {
        const r = await flush();
        if (r !== 'ok') return r;
      }
      batch.push({ path, content: file.content });
      bytes += size;
    }
    return flush();
  }
}

function restore(target: Hashes, from: Hashes, path: string): void {
  if (from[path] === undefined) delete target[path];
  else target[path] = from[path];
}

function hashes(local: Map<string, LocalFile>): Hashes {
  const out: Hashes = {};
  for (const [path, f] of local) out[path] = f.hash;
  return out;
}
