import { useEffect, useMemo, useState } from 'react'
import { MascotBridge } from '../canvas/mascot/MascotBridge'
import { useSessions } from '../canvas/sessionsStore'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { tildify } from '../platform'
import { useInterfaceZoom } from '../theme/useInterfaceZoom'
import { useTheme } from '../theme/useTheme'
import { RequiredUpdateModal } from '../updates/RequiredUpdateModal'
import { ConversationWindow } from './ConversationWindow'

export type PopoutPayload = {
  project: ProjectData
  conversation: ConversationSummary
  // Conta do grupo da pasta quando a janela abriu.
  account?: string
}

const closeWindow = () => window.close()

// Janela própria de uma conversa (aberta pelo botão ↗ do painel).
export function PopoutApp({ id }: { id: string }) {
  const [payload, setPayload] = useState<PopoutPayload | null>(null)
  useTheme()
  useInterfaceZoom()

  useEffect(() => {
    let alive = true
    window.api.popout.payload(id).then(
      (p) => {
        if (alive) setPayload((p as PopoutPayload) ?? null)
      },
      () => {}
    )
    return () => {
      alive = false
    }
  }, [id])

  if (!payload) return null
  return <PopoutConversation payload={payload} />
}

// O payload é a foto da conversa quando a janela abriu: status, título e contexto vêm da lista da
// pasta, que segue atualizando aqui (antes, a conversa rodando no terminal ficava "Trabalhando…"
// para sempre). Fora da lista ainda (acabou de abrir), vale a foto.
function PopoutConversation({ payload }: { payload: PopoutPayload }) {
  const project = useWorktreeProject(payload)
  const sessions = useSessions(project.path)
  const conversation = sessions.find((c) => c.id === payload.conversation.id) ?? payload.conversation

  useEffect(() => {
    document.title = conversation.title
  }, [conversation.title])

  return (
    <div className="relative h-full">
      <ConversationWindow project={project} account={payload.account} conversation={conversation} onClose={closeWindow} />
      {/* Escrevendo um pedido aqui, o mascote solto na tela escuta. */}
      <MascotBridge />
      <RequiredUpdateModal />
    </div>
  )
}

// O Claude levou a conversa para um git worktree, ou de volta (ver canvas/worktrees/useWorktreeMoves):
// o arquivo dela mudou de pasta, e a janela passa a ler da pasta nova.
function useWorktreeProject({ project, conversation }: PopoutPayload): ProjectData {
  const [path, setPath] = useState(project.path)
  useEffect(
    () =>
      window.api.chat.onState((key, state) => {
        const wt = state.worktree
        if (wt && (key === conversation.id || state.sessionId === conversation.id)) setPath(tildify(wt.left ? wt.from : wt.path))
      }),
    [conversation.id]
  )
  return useMemo(() => (path === project.path ? project : { ...project, path }), [project, path])
}
