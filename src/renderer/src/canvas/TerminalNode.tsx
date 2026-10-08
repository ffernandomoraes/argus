import { useEffect, useRef } from 'react'
import { NodeResizer, useNodesData, type NodeProps } from '@xyflow/react'
import { SquareTerminal, Terminal, X } from 'lucide-react'
import { TerminalView } from '../conversation/TerminalView'
import { getConversationSettings } from '../conversation/conversationSettings'
import { launchSettings } from '../conversation/SessionSettings'
import { useCanvasActions } from './CanvasContext'
import { EditableName } from './EditableName'
import { useSessions } from './sessionsStore'
import { PathLabel } from './PathLabel'
import type { AreaNode, TerminalNode as TerminalNodeType } from './types'

// Terminal de verdade morando no canvas, ao lado das pastas: o `claude` ou o shell do sistema.
// O processo vive no processo principal: mover, recolher o grupo ou fechar o app não derruba a sessão.
export function TerminalNode({ id, data, selected, parentId }: NodeProps<TerminalNodeType>) {
  const shell = data.kind === 'shell'
  // Conta do grupo onde o terminal está. Vale ao abrir: o terminal aberto segue na dele.
  const group = useNodesData<AreaNode>(parentId ?? '')
  const account = group?.type === 'area' ? group.data.account : undefined
  // Modelo, esforço e modo valem ao abrir, como no terminal comum; os da conversa que ele retoma.
  const settings = getConversationSettings(data.sessionId)
  const { bindTerminalSession, closeTerminal } = useCanvasActions()

  // O `claude` que roda aqui cria a conversa por conta própria e não avisa qual é. O nó
  // guarda as que a pasta já tinha e adota a que surgir, para retomá-la depois de reabrir o app.
  const sessions = useSessions(data.path)
  const before = useRef<{ ids: Set<string>; since: number } | null>(null)
  useEffect(() => {
    // O shell não cria conversa; adotar uma aqui pegaria a de outro terminal da mesma pasta.
    if (shell || data.sessionId) return
    if (!before.current) {
      before.current = { ids: new Set(sessions.map((s) => s.id)), since: Date.now() }
      return
    }
    const { ids, since } = before.current
    const started = sessions
      .filter((s) => !ids.has(s.id) && Date.parse(s.updatedAt) >= since - 2000)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    if (started) bindTerminalSession(id, started.id)
  }, [sessions, data.sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={360}
        minHeight={220}
        lineStyle={{ borderColor: 'var(--color-line-strong)' }}
        handleStyle={{ background: 'var(--color-muted)', border: 'none', width: 8, height: 8 }}
      />
      <div
        className="flex h-full flex-col overflow-hidden rounded-xl border bg-surface shadow-lg shadow-black/30"
        style={{ borderColor: selected ? 'var(--color-accent)' : 'var(--color-line)' }}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
          {shell ? (
            <Terminal size={14} className="shrink-0 text-muted" />
          ) : (
            <SquareTerminal size={14} className="shrink-0 text-muted" />
          )}
          <EditableName id={id} value={data.name} className="shrink-0 text-sm font-medium" />
          <PathLabel path={data.path} className="ml-auto min-w-0 pl-2 text-[12px] text-faint" />
          <button
            aria-label="Fechar terminal"
            title="Fechar terminal"
            onClick={() => closeTerminal(id, data.name)}
            className="nodrag -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-line hover:text-text"
          >
            <X size={14} />
          </button>
        </header>

        {/* nodrag/nowheel: digitar e rolar valem para o terminal, não para o canvas */}
        <div className="nodrag nowheel flex min-h-0 flex-1 flex-col">
          <TerminalView
            sessionKey={id}
            cwd={data.path}
            account={account}
            shell={shell}
            sessionId={data.sessionId}
            model={settings.model}
            effort={settings.effort}
            settingsJson={launchSettings(settings)}
            permissionMode={settings.permissionMode}
          />
        </div>
      </div>
    </>
  )
}
