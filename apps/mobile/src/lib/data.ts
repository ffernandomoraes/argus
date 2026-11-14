import { useEffect, useState } from 'react';
import type { ActiveChat, ChatDetails, ChatState, InterruptedChat, UnreadChat } from '@argus/shared/chat';
import type { DesktopPreferences } from '@argus/shared/phonePreferences';
import type { ClaudeInfo } from '@argus/shared/models';
import type { ProvidersState } from '@argus/shared/providers';
import type { AuthState } from '@argus/shared/auth';
import type { SessionSummary } from '@argus/shared/sessions';
import type { Usage } from '@argus/shared/usage';
import { PROVIDER_NAMES, type ProviderId } from '@argus/shared/providers';
import { useHost, useRemote, useWatchFolder } from './host';
import { throttle } from './throttle';

// Os dados que as telas mostram, lidos do Argus de casa e atualizados pelos avisos de lá.

// --- Uso do Claude ---

// provider: o agente da conta (Codex...); sem ele, Claude.
export type AccountUsage = { id: string; name: string; usage: Usage | null; provider?: ProviderId };

export function useUsage(): AccountUsage[] {
  const { conn } = useHost();
  const auth = useRemote((c) => c.call('auth:state'), [], 'auth');
  const usage = useRemote((c) => c.call('usage:get'), [], 'usage');
  const [live, setLive] = useState<Record<string, Usage | null>>({});
  useEffect(() => conn.on('usage:update', (account, u) => setLive((prev) => ({ ...prev, [account]: u }))), [conn]);
  useEffect(() => conn.on('auth:state', () => auth.reload()), [conn, auth.reload]);
  // Abrir o app pede uma leitura nova (como abrir o painel de limites no Argus).
  useEffect(() => void conn.call('usage:refresh').catch(() => {}), [conn]);
  const all = { ...(usage.data ?? {}), ...live };
  const accounts = (auth.data as AuthState | undefined)?.accounts ?? [];
  const rows: AccountUsage[] = accounts.filter((a) => a.status?.loggedIn !== false).map((a) => ({ id: a.id, name: a.name, usage: all[a.id] ?? null }));
  // Outros agentes (Codex...): a chave é "agente:conta".
  for (const [id, u] of Object.entries(all)) {
    if (!id.includes(':') || !u) continue;
    const agent = id.split(':')[0] as ProviderId;
    if (!(agent in PROVIDER_NAMES)) continue;
    rows.push({ id, name: PROVIDER_NAMES[agent], usage: u, provider: agent });
  }
  return rows;
}

// --- Conversas em andamento ---

export function useActiveChats(): ActiveChat[] {
  const { conn } = useHost();
  const r = useRemote((c) => c.call('chat:active'), [], 'active');
  const [live, setLive] = useState<ActiveChat[] | null>(null);
  useEffect(() => conn.on('chat:active', (list) => setLive(list)), [conn]);
  useEffect(() => setLive(null), [r.data]);
  return live ?? r.data ?? [];
}

export function useInterrupted(): { list: InterruptedChat[]; dismiss: (id: string) => void } {
  const { conn } = useHost();
  const r = useRemote((c) => c.call('chat:interrupted'), [], 'interrupted');
  const [live, setLive] = useState<InterruptedChat[] | null>(null);
  useEffect(() => conn.on('chat:interrupted', (list) => setLive(list)), [conn]);
  useEffect(() => setLive(null), [r.data]);
  return { list: live ?? r.data ?? [], dismiss: (id) => void conn.call('chat:dismissInterrupted', id).catch(() => {}) };
}

// --- Respostas que ninguém viu ainda (a bolinha verde do Argus) ---

// As janelas do Argus contam quais conversas terminaram sem ninguém olhar; abrir no celular ou no
// Argus tira das duas listas (markRead avisa as janelas).
export function useUnread(): { ids: ReadonlySet<string>; markRead: (id: string) => void } {
  const { conn } = useHost();
  // Argus antigo não tem o canal: sem bolinhas verdes.
  const r = useRemote((c) => c.call('chat:unreadList').catch(() => []), [], 'unread');
  const [live, setLive] = useState<UnreadChat[] | null>(null);
  useEffect(() => conn.on('chat:unreadList', (list) => setLive(list)), [conn]);
  useEffect(() => setLive(null), [r.data]);
  const list = live ?? r.data ?? [];
  return { ids: new Set(list.map((c) => c.id)), markRead: (id) => void conn.call('chat:markRead', id).catch(() => {}) };
}

// --- Projetos (as pastas dos workspaces do canvas) ---

export type Folder = {
  id: string
  name: string
  path: string
  color?: string
  // Conta do Claude do grupo da pasta (sem ela, a padrão).
  account?: string
  // Workspace: as pastas que o agente recebe junto.
  folders?: string[]
  // Tarefa isolada (git worktree) de outra pasta.
  worktree: boolean
  // O grupo da pasta (nome e cor), para o topo da tela dela; sem grupo, vazio.
  group?: { label: string; color?: string }
};

export type Group = { id: string; label: string; color?: string; folders: Folder[] };
export type Workspace = { id: string; name: string; groups: Group[] };

type RawNode = { id?: unknown; type?: unknown; parentId?: unknown; data?: Record<string, unknown> };

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// Os nós do canvas de um workspace: grupos (area) e pastas (project). Pastas fora de grupo ficam num
// grupo sem nome, no fim.
export function groupsOf(nodes: unknown): Group[] {
  if (!Array.isArray(nodes)) return [];
  const areas = new Map<string, Group & { account?: string }>();
  const loose: Group = { id: '', label: '', folders: [] };
  for (const n of nodes as RawNode[]) {
    if (n?.type === 'area' && typeof n.id === 'string')
      areas.set(n.id, { id: n.id, label: str(n.data?.label) ?? '', color: str(n.data?.color), account: str(n.data?.account), folders: [] });
  }
  for (const n of nodes as RawNode[]) {
    if (n?.type !== 'project' || typeof n.id !== 'string' || !n.data) continue;
    const path = str(n.data.path);
    if (!path) continue;
    const area = typeof n.parentId === 'string' ? areas.get(n.parentId) : undefined;
    const folders = Array.isArray(n.data.folders) ? (n.data.folders as unknown[]).filter((f): f is string => typeof f === 'string') : undefined;
    (area ?? loose).folders.push({
      id: n.id,
      name: str(n.data.name) ?? path.split(/[\\/]/).pop() ?? path,
      path,
      color: str(n.data.color),
      account: area?.account,
      folders: folders?.length ? folders : undefined,
      worktree: !!n.data.worktree,
      group: area ? { label: area.label, color: area.color } : undefined,
    });
  }
  // Grupos vazios também: dá para adicionar pasta neles pelo celular (a lista não mostra os vazios).
  const groups = [...areas.values()];
  if (loose.folders.length) groups.push(loose);
  return groups;
}

export function useWorkspaces(): { workspaces: Workspace[]; loaded: boolean } {
  const { conn } = useHost();
  const r = useRemote(async (c) => {
    const state = await c.call('boards:state');
    const open = state.boards.filter((b) => !b.closed);
    const loaded = await Promise.all(open.map(async (b) => ({ id: b.id, name: b.name, groups: groupsOf(await c.call('canvas:load', b.id)) })));
    // Workspace sem nada também: acabou de ser criado e recebe pastas pelo celular.
    return loaded;
  }, [], 'workspaces');
  useEffect(() => conn.on('boards:changed', () => r.reload()), [conn, r.reload]);
  if (r.data) lastFolders = r.data.flatMap((w) => w.groups.flatMap((g) => g.folders));
  return { workspaces: r.data ?? [], loaded: r.data !== undefined };
}

// A última lista de pastas lida: a conversa usa a conta e as pastas do workspace dela.
let lastFolders: Folder[] = [];
export const folderByPath = (path: string): Folder | undefined => lastFolders.find((f) => f.path === path);

// --- Conversas de uma pasta ---

export function useSessions(path: string | null): { list: SessionSummary[] | undefined; reload: () => void } {
  const { conn } = useHost();
  useWatchFolder(path);
  const r = useRemote((c) => (path ? c.call('sessions:list', path) : Promise.resolve(null)), [path], path ? `sessions:${path}` : undefined);
  // Mudança no git não mexe na lista; as outras, no máximo uma releitura por segundo.
  useEffect(() => {
    const later = throttle(r.reload, 1000);
    const off = conn.on('sessions:changed', (p, change) => p === path && change !== 'git' && later.run());
    return () => {
      off();
      later.cancel();
    };
  }, [conn, path, r.reload]);
  const list = r.data ? [...r.data].sort((a, b) => (b.repliedAt || b.updatedAt).localeCompare(a.repliedAt || a.updatedAt)) : r.data === null ? [] : undefined;
  return { list, reload: r.reload };
}

export type RecentChat = SessionSummary & { cwd: string };

// Todas as conversas das pastas do canvas, das mais recentes para as antigas: as recentes e a busca
// da aba Conversas. Relidas quando alguma conversa grava (no máximo a cada 5 s).
export function useAllChats(paths: string[]): RecentChat[] {
  const { conn } = useHost();
  const key = [...new Set(paths)].sort().join('\n');
  const r = useRemote(async (c) => {
    const lists = await Promise.all(
      (key ? key.split('\n') : []).map(async (cwd) => ((await c.call('sessions:list', cwd).catch(() => null)) ?? []).map((s) => ({ ...s, cwd }))),
    );
    const at = (s: SessionSummary) => s.repliedAt || s.updatedAt;
    return lists.flat().sort((a, b) => at(b).localeCompare(at(a)));
  }, [key], 'allChats');
  useEffect(() => {
    const later = throttle(r.reload, 5000);
    const off = conn.on('sessions:changed', (p, change) => change === 'transcript' && key.split('\n').includes(p) && later.run());
    return () => {
      off();
      later.cancel();
    };
  }, [conn, key, r.reload]);
  return r.data ?? [];
}

// Branch do git da pasta, para o pé da caixa de escrever. Nulo: sem git, ou o Argus de casa é de uma
// versão que não responde isto. Relida quando o git da pasta muda (checkout, commit).
export function useBranch(path: string): string | null {
  const { conn } = useHost();
  const r = useRemote((c) => c.call('sessions:branch', path).catch(() => null), [path], `branch:${path}`);
  useEffect(() => conn.on('sessions:changed', (p, change) => p === path && change === 'git' && r.reload()), [conn, path, r.reload]);
  return r.data ?? null;
}

// Conversas favoritas (ids das sessões), as mesmas da janela do Argus.
export function useFavorites(): ReadonlySet<string> {
  const { conn } = useHost();
  const r = useRemote((c) => c.call('favorites:get'), [], 'favorites');
  const [live, setLive] = useState<string[] | null>(null);
  useEffect(() => conn.on('favorites:changed', (ids) => setLive(ids)), [conn]);
  useEffect(() => setLive(null), [r.data]);
  const ids = live ?? r.data ?? [];
  return new Set(ids);
}

// Títulos das conversas de cada pasta, para a lista de em andamento. Relidos quando alguma conversa
// das pastas grava (no máximo a cada 2 s): conversa criada no Argus ganha o título depois.
export function useTitles(paths: string[]): Map<string, string> {
  const { conn } = useHost();
  const key = [...new Set(paths)].sort().join('\n');
  const r = useRemote(async (c) => {
    const out = new Map<string, string>();
    for (const p of key ? key.split('\n') : []) {
      const list = await c.call('sessions:list', p).catch(() => null);
      for (const s of list ?? []) out.set(s.id, s.title);
    }
    return out;
  }, [key], `titles:${key}`);
  useEffect(() => {
    const later = throttle(r.reload, 2000);
    const off = conn.on('sessions:changed', (p, change) => change === 'transcript' && key.split('\n').includes(p) && later.run());
    return () => {
      off();
      later.cancel();
    };
  }, [conn, key, r.reload]);
  return r.data ?? new Map();
}

// --- Uma conversa aberta ---

// O estado ao vivo da conversa `key` (resposta sendo escrita, permissões, etapa). A conversa fica
// segura enquanto a tela está aberta, como no Argus (a sessão não fecha no meio).
export function useChatState(key: string): ChatState | null {
  const { conn, epoch } = useHost();
  const [state, setState] = useState<ChatState | null>(null);
  useEffect(() => {
    if (conn.status !== 'online') return;
    void conn.call('chat:retain', key).catch(() => {});
    conn.call('chat:state', key).then(
      (s) => setState((prev) => s ?? prev),
      () => {},
    );
    return () => void conn.call('chat:release', key).catch(() => {});
  }, [conn, key, epoch]);
  useEffect(() => conn.on('chat:state', (k, s) => k === key && setState(s)), [conn, key]);
  return state;
}

// --- Contas e modelos ---

// O que o celular herda do Argus do computador (padrão das conversas, sugestões, tema e idioma). Nulo:
// o Argus ainda não respondeu, ou é de uma versão sem isso.
export function useDesktopPreferences(): DesktopPreferences | null {
  const r = useRemote((c) => c.call('preferences:forPhone').catch(() => null), [], 'desktopPreferences');
  return r.data ?? null;
}

export function useAuthState(): AuthState | undefined {
  const { conn } = useHost();
  const r = useRemote((c) => c.call('auth:state'), [], 'auth');
  const [live, setLive] = useState<AuthState | null>(null);
  useEffect(() => conn.on('auth:state', (s) => setLive(s)), [conn]);
  useEffect(() => setLive(null), [r.data]);
  return live ?? r.data;
}

export function useProvidersState(): ProvidersState | undefined {
  const { conn } = useHost();
  const r = useRemote((c) => c.call('providers:state'), [], 'providers');
  const [live, setLive] = useState<ProvidersState | null>(null);
  useEffect(() => conn.on('providers:state', (s) => setLive(s)), [conn]);
  useEffect(() => setLive(null), [r.data]);
  return live ?? r.data;
}

// Modelos, esforços e modo padrão de uma conta (do Claude ou "agente:conta"). Chega alguns segundos
// depois de o Argus abrir: o aviso claude:info traz quando ainda não veio.
export function useAgentInfo(account: string | undefined): ClaudeInfo | null {
  const { conn } = useHost();
  const r = useRemote((c) => (account ? c.call('claude:info', account) : Promise.resolve(null)), [account], account ? `info:${account}` : undefined);
  const [live, setLive] = useState<ClaudeInfo | null>(null);
  useEffect(() => setLive(null), [account, r.data]);
  useEffect(() => conn.on('claude:info', (a, info) => a === account && setLive(info)), [conn, account]);
  return live ?? r.data ?? null;
}

// Conta e modelo/esforço/modo da conversa aberta no Argus; nulo sem sessão aberta. Relido quando a
// conversa muda de status (abriu, terminou um pedido).
export function useChatDetails(key: string, status: string | undefined): ChatDetails | null {
  const r = useRemote((c) => c.call('chat:details', key), [key, status]);
  return r.data ?? null;
}
