import { useEffect, useMemo } from 'react'
import type { BoardSummary } from '../../../shared/canvas'
import type { ActiveChat, InterruptedChat } from '../../../shared/chat'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'
import { activeChats, useActiveChats } from './activeChats'
import { boardsStore } from './boards'
import { canvasScope, inScope } from './canvasScope'
import { displayPath } from './factory'
import { useInterruptedChats } from './interruptedChats'
import { watch } from './sessionsStore/observers'
import { store as sessionsStore } from './sessionsStore/state'
import { unread } from './sessionsStore/unread'

// O indicador de conversas da barra de baixo vale para todos os workspaces, não só o desta janela:
// entra a conversa que está no canvas daqui ou em algum workspace (a pasta dele ou ela solta nele).
// A de pasta que não está em workspace nenhum fica de fora, porque o clique não teria aonde levar.

const inBoard = (b: BoardSummary, path: string, id: string | undefined) => b.paths.includes(path) || (!!id && b.sessions.includes(id))

type Scope = ReturnType<typeof canvasScope.get>
const reachable = (scope: Scope, boards: BoardSummary[], path: string, id: string | undefined) =>
  inScope(scope, path, id) || boards.some((b) => inBoard(b, path, id))

function useReachable(): (path: string, id: string | undefined) => boolean {
  const scope = useStore(canvasScope)
  const boards = useStore(boardsStore, (s) => s.boards)
  return (path, id) => reachable(scope, boards, path, id)
}

export function useActiveChatsEverywhere(): ActiveChat[] {
  const chats = useActiveChats()
  const isReachable = useReachable()
  const shown = chats.filter((c) => isReachable(displayPath(c.cwd), c.sessionId ?? c.key))
  return shown.length === chats.length ? chats : shown
}

export function useInterruptedEverywhere(): InterruptedChat[] {
  const list = useInterruptedChats()
  const isReachable = useReachable()
  const shown = list.filter((c) => isReachable(displayPath(c.cwd), c.sessionId))
  return shown.length === list.length ? list : shown
}

// Pastas onde já rodou alguma conversa nesta janela. Cobre a conversa posta solta em outro
// workspace: a pasta dela não está em nenhum, e sem ler a lista dela não daria para saber que ela
// terminou. Só cresce enquanto a janela está aberta.
const ranIn = createStore<ReadonlySet<string>>(new Set())
const noteRan = () => {
  const paths = activeChats.get().map((c) => displayPath(c.cwd))
  ranIn.set((s) => (paths.every((p) => s.has(p)) ? s : new Set([...s, ...paths])))
}
activeChats.subscribe(noteRan)
noteRan()

// Conversas que terminaram sem você ver (bolinha verde), de todos os workspaces: a pasta como está
// no store, o id e o título. Para saber delas, as pastas dos outros workspaces também são lidas
// enquanto a barra estiver na tela (a lista e a branch, sem o git status). A que voltou a
// trabalhar sai daqui (já aparece como ativa).
export type FinishedChat = { path: string; id: string; title: string }
const NO_FINISHED: FinishedChat[] = []

export function useFinishedChatsEverywhere(): FinishedChat[] {
  const boards = useStore(boardsStore, (s) => s.boards)
  const ran = useStore(ranIn)
  // Caminho não tem \0: a lista vira uma chave estável entre renders.
  const key = [...new Set([...boards.flatMap((b) => b.paths), ...ran])].sort().join('\0')
  useEffect(() => {
    const stops = (key ? key.split('\0') : []).map((path) => watch(path))
    return () => stops.forEach((stop) => stop())
  }, [key])

  const ids = useStore(unread)
  const sessions = useStore(sessionsStore, (s) => s.sessions)
  const scope = useStore(canvasScope)
  return useMemo(() => {
    const list: FinishedChat[] = []
    if (ids.size) {
      for (const [path, conversations] of sessions) {
        for (const c of conversations) {
          if (ids.has(c.id) && c.status === 'idle' && reachable(scope, boards, path, c.id)) list.push({ path, id: c.id, title: c.title })
        }
      }
    }
    // Nenhuma: sempre a mesma lista vazia. A lista das pastas muda a cada passo do Claude, e uma
    // vazia nova redesenhava a barra de baixo à toa.
    return list.length ? list : NO_FINISHED
  }, [ids, sessions, scope, boards])
}

// Nome do outro workspace onde a conversa está; nulo quando ela está no canvas desta janela.
export function useOtherBoardName(path: string, id: string | undefined): string | null {
  const scope = useStore(canvasScope)
  const { boards, current } = useStore(boardsStore)
  if (inScope(scope, path, id)) return null
  return boards.find((b) => b.id !== current && inBoard(b, path, id))?.name ?? null
}
