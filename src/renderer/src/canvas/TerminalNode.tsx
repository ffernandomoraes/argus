import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NodeResizer, useNodesData, type NodeProps } from '@xyflow/react'
import { Maximize2, Minimize2, SquareTerminal, Terminal, X } from 'lucide-react'
import { TerminalView } from '../conversation/TerminalView'
import { getConversationSettings } from '../conversation/conversationSettings'
import { launchSettings } from '../conversation/SessionSettings'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'
import { drawerZoomKey } from '../conversation/useDrawerZoom'
import { usePreferences } from '../settings/preferences'
import { MOTION, reduced } from '../motion'
import { useEscape } from '../useEscape'
import { IS_WIN } from '../platform'
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

  // Modo foco: o terminal cobre a área toda abaixo da barra de título, como a conversa no drawer.
  // O bloco não sai do lugar no canvas; enquanto isso, o terminal mora só na camada de cima. Trocar
  // de lugar recria a tela do xterm, mas o processo é o mesmo e devolve o que já tinha escrito.
  const [focus, setFocus] = useState(false)
  const focusRef = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)
  // No foco, ⌘+ e ⌘- mudam a fonte, na mesma escala do drawer.
  const zoom = usePreferences().drawerZoom
  useLayoutEffect(() => {
    if (!focus || reduced()) return
    focusRef.current?.animate([{ opacity: 0, transform: MOTION.panel.from }, { opacity: 1, transform: 'none' }], MOTION.panel.in)
  }, [focus])
  const exitFocus = async () => {
    const panel = focusRef.current
    if (leaving.current) return
    if (panel && !reduced()) {
      leaving.current = true
      const out = panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: MOTION.panel.to }], {
        ...MOTION.panel.out,
        fill: 'forwards'
      })
      await out.finished.catch(() => {})
      leaving.current = false
    }
    setFocus(false)
  }
  // Só vale com o foco fora do terminal (no cabeçalho): dentro dele, o ESC é do programa (useEscape).
  useEscape(exitFocus, focus)

  const header = (actions: ReactNode) => (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
      {shell ? (
        <Terminal size={14} className="shrink-0 text-muted" />
      ) : (
        <SquareTerminal size={14} className="shrink-0 text-muted" />
      )}
      <EditableName id={id} value={data.name} className="shrink-0 text-sm font-medium" />
      <PathLabel path={data.path} className="ml-auto min-w-0 pl-2 text-[12px] text-faint" />
      {actions}
    </header>
  )

  const terminal = (fontScale?: number) => (
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
      fontScale={fontScale}
    />
  )

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
        {header(
          <>
            <HeaderIcon label="Modo foco" onClick={() => setFocus(true)}>
              <Maximize2 size={13} />
            </HeaderIcon>
            <HeaderIcon label="Fechar terminal" onClick={() => closeTerminal(id, data.name)}>
              <X size={14} />
            </HeaderIcon>
          </>
        )}

        {/* nodrag/nowheel: digitar e rolar valem para o terminal, não para o canvas */}
        <div className="nodrag nowheel flex min-h-0 flex-1 flex-col">
          {focus ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-surface text-xs text-muted">
              Em modo foco
              <button
                onClick={exitFocus}
                className="rounded-md border border-line px-2 py-1 text-text hover:bg-surface-2"
              >
                Sair do modo foco
              </button>
            </div>
          ) : (
            terminal()
          )}
        </div>
      </div>

      {focus &&
        createPortal(
          // Na captura: ⌘+ e ⌘- não chegam ao xterm nem ao zoom do canvas. No Mac, o Ctrl fica com
          // o programa (Ctrl+- desfaz no nano). O portal repassa os eventos ao bloco no canvas; os
          // de mouse param aqui (selecionar, menu do bloco).
          <div
            ref={focusRef}
            onKeyDownCapture={(e) => (IS_WIN || e.metaKey) && drawerZoomKey(e.nativeEvent) && e.stopPropagation()}
            onClick={stop}
            onDoubleClick={stop}
            onContextMenu={stop}
            onPointerDown={stop}
            onMouseDown={stop}
            className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-surface"
            style={{ top: TITLE_BAR_HEIGHT }}
          >
            {header(
              <HeaderIcon label="Sair do modo foco" onClick={exitFocus}>
                <Minimize2 size={13} />
              </HeaderIcon>
            )}
            {terminal(zoom)}
          </div>,
          document.body
        )}
    </>
  )
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

function HeaderIcon({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="nodrag flex size-6 shrink-0 items-center justify-center rounded-md text-muted last:-mr-1 hover:bg-line hover:text-text"
    >
      {children}
    </button>
  )
}
