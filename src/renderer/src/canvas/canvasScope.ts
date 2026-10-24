import type { ActiveChat } from '../../../shared/chat'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'
import { useActiveChats } from './activeChats'
import { displayPath } from './factory'
import type { CanvasNode } from './types'

// O que está no canvas desta janela (o workspace dela): as pastas (blocos de pasta) e as conversas
// postas soltas (card de conversa sem projeto, conversa aberta no canvas). Pasta fora do canvas não conta para o
// "concluído", o ícone da barra de menus nem o mascote, mesmo que a lista dela ainda esteja guardada
// (pasta removida, aberta pela notificação) ou que outra cópia do app (produção x desenvolvimento)
// esteja trabalhando nela.
// Nulo: janela sem canvas (conversa em janela separada), que não filtra nada.
type Scope = { paths: ReadonlySet<string>; sessions: ReadonlySet<string> } | null

export const canvasScope = createStore<Scope>(null)

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x))

// Chamado pelo canvas a cada mudança dos blocos; só avisa quando pastas ou conversas mudam. Só o
// workspace desta janela conta: a conversa de outro aparece aqui só se a pasta dela também estiver
// neste. O que roda nos outros aparece na bolinha do menu de workspaces (bars/BoardSwitcher).
export function setCanvasScope(nodes: readonly CanvasNode[]): void {
  const paths = new Set<string>()
  const sessions = new Set<string>()
  for (const n of nodes) {
    if (n.type === 'project') paths.add(n.data.path)
    else if (n.type === 'chat' || n.type === 'chatPanel') sessions.add(n.data.sessionId)
  }
  canvasScope.set((s) => (s && sameSet(s.paths, paths) && sameSet(s.sessions, sessions) ? s : { paths, sessions }))
}

// A conversa (pela pasta como o store guarda e pelo id) está no canvas desta janela.
export function inScope(s: Scope, path: string, id: string | undefined): boolean {
  return !s || s.paths.has(path) || (!!id && s.sessions.has(id))
}

// Conversas do app trabalhando ou esperando você, só das pastas que estão no canvas.
export function useActiveChatsInCanvas(): ActiveChat[] {
  const chats = useActiveChats()
  const s = useStore(canvasScope)
  return s ? chats.filter((c) => inScope(s, displayPath(c.cwd), c.sessionId ?? c.key)) : chats
}
