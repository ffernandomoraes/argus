// Instruções e skills dos agentes na conta do Argus (item 1f; nasceu só com o Claude, daí os nomes).
// Por provedor: Claude (CLAUDE.md, skills, agentes e comandos do ~/.claude), Codex (AGENTS.md e
// skills do ~/.codex), Gemini (GEMINI.md e comandos do ~/.gemini; o Antigravity lê o mesmo GEMINI.md)
// e Cursor (comandos e skills do ~/.cursor; as regras do usuário ficam na nuvem do próprio Cursor).
// Configurações (settings.json, config.toml, mcp.json) ficam de fora. A conta guarda a última versão
// de cada arquivo, que cada computador manda sozinho quando muda aqui. O que chega de outro
// computador não entra sozinho: o Perfil mostra o que é novo ou diferente, e a pessoa importa (ou,
// quando os dois mudaram, escolhe qual fica). Apagar aqui não apaga da conta; "Tirar da conta" sim.
// Aqui ficam as regras puras; quem lê e grava os arquivos é apps/desktop/src/main/account/claude*.ts.

export type AgentSource = 'claude' | 'codex' | 'gemini' | 'cursor';
export const AGENT_SOURCES: readonly AgentSource[] = ['claude', 'codex', 'gemini', 'cursor'];

// instructions: o arquivo de instruções globais (CLAUDE.md, AGENTS.md, GEMINI.md).
export type ClaudeKind = 'instructions' | 'skill' | 'agent' | 'command';

// Cada arquivo é identificado pelo caminho na conta, com barra comum: o do Claude como está dentro do
// ~/.claude ("skills/x/SKILL.md"); os outros com o provedor na frente ("codex/AGENTS.md").
export type ClaudeFileMeta = { path: string; hash: string; size: number; updatedAt: number };
export type ClaudeFileContent = { path: string; content: string };

// synced: igual aqui e na conta. new: só na conta. updated: a conta tem uma versão mais nova e a
// daqui não mudou. conflict: mudou aqui e na conta desde a última vez.
export type ClaudeItemStatus = 'synced' | 'new' | 'updated' | 'conflict';

// Um item da lista: o arquivo de instruções, uma skill (a pasta inteira), um agente ou um comando.
export type ClaudeItem = { key: string; source: AgentSource; kind: ClaudeKind; name: string; status: ClaudeItemStatus; files: number };

export type ClaudeAction = 'import' | 'keepLocal' | 'remove';

// Limites (somando todos os provedores) também conferidos pelo servidor.
export const MAX_CLAUDE_FILE_BYTES = 256 * 1024;
export const MAX_CLAUDE_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_CLAUDE_FILES = 1000;

// Onde cada coisa fica na pasta de cada provedor. min/max: quantas partes do caminho depois da área
// (skill: a pasta dela e o arquivo, no mínimo); ext: a extensão exigida.
export type AgentArea = { dir: string; kind: Exclude<ClaudeKind, 'instructions'>; min: number; max: number; ext?: string };
export type AgentLayout = { prefix: string; instructions?: string; areas: AgentArea[] };

const SKILLS: AgentArea = { dir: 'skills', kind: 'skill', min: 2, max: 6 };
export const AGENT_LAYOUT: Record<AgentSource, AgentLayout> = {
  claude: {
    prefix: '',
    instructions: 'CLAUDE.md',
    areas: [SKILLS, { dir: 'agents', kind: 'agent', min: 1, max: 3, ext: '.md' }, { dir: 'commands', kind: 'command', min: 1, max: 4, ext: '.md' }],
  },
  codex: { prefix: 'codex/', instructions: 'AGENTS.md', areas: [SKILLS] },
  gemini: { prefix: 'gemini/', instructions: 'GEMINI.md', areas: [{ dir: 'commands', kind: 'command', min: 1, max: 4, ext: '.toml' }] },
  cursor: { prefix: 'cursor/', areas: [{ dir: 'commands', kind: 'command', min: 1, max: 4, ext: '.md' }, SKILLS] },
};

const SEGMENT = /^[\w@+()[\]{}, =-][\w.@+()[\]{}, =-]*$/;

// O provedor e o caminho dentro da pasta dele.
export function splitAgentPath(path: string): { source: AgentSource; rel: string } | null {
  for (const source of AGENT_SOURCES) {
    const { prefix } = AGENT_LAYOUT[source];
    if (prefix && path.startsWith(prefix)) return { source, rel: path.slice(prefix.length) };
  }
  return { source: 'claude', rel: path };
}

// O que um caminho é: o arquivo de instruções ou o item de uma área. Nulo: não vai para a conta.
function classify(path: string): { source: AgentSource; rel: string; kind: ClaudeKind; area?: AgentArea } | null {
  if (path.length > 240 || path.includes('\\')) return null;
  const parts = path.split('/');
  if (parts.some((p) => !SEGMENT.test(p) || p.length > 120)) return null;
  const split = splitAgentPath(path);
  if (!split) return null;
  const layout = AGENT_LAYOUT[split.source];
  if (split.rel === layout.instructions) return { ...split, kind: 'instructions' };
  const [dir, ...rest] = split.rel.split('/');
  const area = layout.areas.find((a) => a.dir === dir);
  if (!area || rest.length < area.min || rest.length > area.max || (area.ext && !split.rel.endsWith(area.ext))) return null;
  return { ...split, kind: area.kind, area };
}

// Caminho aceito: só os arquivos e as áreas de cada provedor, sem "..", sem arquivo ou pasta oculta
// e sem barra invertida. O servidor confere igual, e o app confere de novo antes de gravar no disco.
export const isAgentFilePath = (path: string): boolean => classify(path) !== null;

// O item de um arquivo: a skill é a pasta dela; agente e comando, o próprio arquivo.
export function claudeItemOf(path: string): { key: string; source: AgentSource; kind: ClaudeKind; name: string } | null {
  const c = classify(path);
  if (!c) return null;
  const prefix = AGENT_LAYOUT[c.source].prefix;
  if (c.kind === 'instructions') return { key: path, source: c.source, kind: c.kind, name: c.rel };
  const [dir, first, ...rest] = c.rel.split('/');
  if (c.kind === 'skill') return { key: `${prefix}${dir}/${first}`, source: c.source, kind: 'skill', name: first! };
  const inner = [first, ...rest].join('/').replace(/\.(md|toml)$/, '');
  if (c.kind === 'agent') return { key: path, source: c.source, kind: 'agent', name: inner.split('/').pop() ?? inner };
  // Comando em subpasta vira "/pasta:nome", como o Claude Code e o Gemini mostram.
  return { key: path, source: c.source, kind: 'command', name: `/${inner.split('/').join(':')}` };
}

export type Hashes = Record<string, string>;

export type ClaudePlan = {
  // Arquivos daqui que vão para a conta agora (novos ou mudados só aqui).
  upload: string[]
  items: ClaudeItem[]
  // O que este computador passa a saber que está igual aqui e na conta.
  known: Hashes
};

const RANK: Record<ClaudeItemStatus, number> = { synced: 0, new: 1, updated: 2, conflict: 3 };

// Compara os arquivos daqui (`local`), os da conta (`remote`) e o que estava igual nos dois da
// última vez (`known`), arquivo por arquivo, e junta por item (o pior estado vence).
export function planClaude(local: Hashes, remote: Hashes, known: Hashes): ClaudePlan {
  const upload: string[] = [];
  const nextKnown: Hashes = { ...known };
  const status = new Map<string, ClaudeItemStatus>();
  const files = new Map<string, number>();
  const meta = new Map<string, { key: string; source: AgentSource; kind: ClaudeKind; name: string }>();
  const mark = (path: string, s: ClaudeItemStatus) => {
    const item = claudeItemOf(path);
    if (!item) return;
    meta.set(item.key, item);
    files.set(item.key, (files.get(item.key) ?? 0) + 1);
    const prev = status.get(item.key);
    if (!prev || RANK[s] > RANK[prev]) status.set(item.key, s);
  };
  for (const path of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const l = local[path];
    const r = remote[path];
    const k = known[path];
    if (l && r && l === r) {
      nextKnown[path] = l;
      mark(path, 'synced');
    } else if (l && !r) {
      // Tirado da conta noutro computador (estava igual aqui): não volta, a não ser que mude aqui.
      if (k === l) continue;
      upload.push(path);
      nextKnown[path] = l;
      mark(path, 'synced');
    } else if (!l && r) {
      // Apagado aqui depois de igual: a conta não insiste, até chegar uma versão nova de lá.
      if (k === r) continue;
      mark(path, 'new');
    } else if (l && r) {
      if (k === r) {
        upload.push(path);
        nextKnown[path] = l;
        mark(path, 'synced');
      } else if (k === l) mark(path, 'updated');
      else mark(path, 'conflict');
    }
  }
  const items: ClaudeItem[] = [];
  for (const [key, s] of status) items.push({ ...meta.get(key)!, status: s, files: files.get(key) ?? 0 });
  items.sort(
    (a, b) =>
      AGENT_SOURCES.indexOf(a.source) - AGENT_SOURCES.indexOf(b.source) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name),
  );
  return { upload, items, known: nextKnown };
}

const KIND_ORDER: ClaudeKind[] = ['instructions', 'skill', 'agent', 'command'];

// Os arquivos de um item (a skill "codex/skills/x" pega todos os de dentro da pasta).
export function filesOfItem(key: string, paths: Iterable<string>): string[] {
  const skill = /(^|\/)skills\/[^/]+$/.test(key);
  const out: string[] = [];
  for (const p of paths) if (p === key || (skill && p.startsWith(`${key}/`))) out.push(p);
  return out;
}
