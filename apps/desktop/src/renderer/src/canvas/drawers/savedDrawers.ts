import type { PanelRect } from '../../conversation/panelGeometry';
import type { ActiveConversation } from '../CanvasContext';
import type { CanvasNode } from '../types';
import { INITIAL_DRAWERS, type Drawer, type DrawerState } from './drawerState';

// Drawers de cada workspace (os fixados e o solto), guardados nesta janela: voltam quando o canvas
// monta de novo (troca de workspace, app reaberto ou atualizado, janela do acesso remoto recarregada
// ao religar), no mesmo lugar e na mesma ordem. Antes sumiam e a conversa ficava só na lista da pasta.
// O acesso remoto guarda à parte, por computador: os workspaces de lá têm ids que podem coincidir
// com os daqui.

// pinned ausente: guardado por versão antiga, que só gravava os fixados.
type Saved = { conversation: ActiveConversation; rect: PanelRect | null; pinned?: boolean };

// O nome antigo fica: assim os fixados guardados antes continuam voltando.
const PREFIX = 'argus.pinnedDrawers';

function storageKey(board: string): string {
  const host = window.api.remote.host;
  return host ? `${PREFIX}:remote:${host.name}:${host.homeDir}:${board}` : `${PREFIX}:${board}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRect = (value: unknown): value is PanelRect =>
  isRecord(value) && [value.x, value.y, value.width, value.height].every((n) => Number.isFinite(n));

// O que dá para reabrir. Rascunho ainda sem sessão não tem conversa salva; com sessão, volta como a
// conversa dela. O lugar do clique (`at`) só valia para a conversa nova.
function reopenable(c: ActiveConversation): ActiveConversation | null {
  const id = c.draft ? c.sessionId : c.conversationId;
  if (!id) return null;
  return {
    nodeId: c.nodeId,
    conversationId: id,
    ...(c.sessionId && { sessionId: c.sessionId }),
    ...(c.subagent && { subagent: c.subagent }),
    ...(c.tasks && { tasks: c.tasks }),
  };
}

function parse(raw: string | null): Saved[] {
  try {
    const list: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.filter(
      (item): item is Saved =>
        isRecord(item) &&
        isRecord(item.conversation) &&
        typeof item.conversation.conversationId === 'string' &&
        (item.conversation.nodeId === null || typeof item.conversation.nodeId === 'string') &&
        (item.rect === null || isRect(item.rect)) &&
        (item.pinned === undefined || typeof item.pinned === 'boolean'),
    );
  } catch {
    return [];
  }
}

// Estado inicial dos drawers do workspace: os guardados cuja pasta (ou card) ainda está no canvas.
// Sem nenhum, nenhum drawer aberto.
export function loadBoardDrawers(board: string, nodes: CanvasNode[]): DrawerState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(board));
  } catch {
    return INITIAL_DRAWERS;
  }
  const ids = new Set(nodes.map((n) => n.id));
  const kept = parse(raw).filter((s) => s.conversation.nodeId === null || ids.has(s.conversation.nodeId));
  // Solto há um só: o último (o de cima).
  const loose = kept.filter((s) => s.pinned === false).pop();
  const drawers: Drawer[] = kept
    .filter((s) => s.pinned !== false || s === loose)
    .map((s, i) => ({ id: `d${i + 1}`, conversation: s.conversation, pinned: s.pinned !== false, rect: s.rect }));
  return drawers.length ? { ...INITIAL_DRAWERS, drawers, nextId: drawers.length + 1 } : INITIAL_DRAWERS;
}

// Grava os drawers do workspace, na ordem em que estão (nenhum: apaga a chave).
export function saveBoardDrawers(board: string, drawers: readonly Drawer[]): void {
  const saved: Saved[] = drawers.flatMap((d) => {
    const conversation = reopenable(d.conversation);
    return conversation ? [{ conversation, rect: d.rect, pinned: d.pinned }] : [];
  });
  try {
    if (saved.length) localStorage.setItem(storageKey(board), JSON.stringify(saved));
    else localStorage.removeItem(storageKey(board));
  } catch {
    // Sem armazenamento: só não volta depois.
  }
}
