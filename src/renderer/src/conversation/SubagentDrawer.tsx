import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect, type CSSProperties, type PointerEvent } from 'react'
import { ArrowLeft, Bot, Pin, PinOff, X } from 'lucide-react'
import type { SubagentRef } from '../canvas/CanvasContext'
import { agentActivity, useRunningAgent } from '../canvas/runningAgents'
import type { ProjectData } from '../canvas/types'
import { useStableCallback } from '../lib/useStableCallback'
import { MOTION, reduced } from '../motion'
import { useEscape } from '../useEscape'
import type { RunningAgent } from '../../../shared/agents'
import { askColors } from './askColors'
import { ChatView } from './ChatView'
import { locate } from './ConversationView'
import { Elapsed } from './Elapsed'
import { FileLinkContext, type LineRange } from './fileLinks'
import { HeaderButton } from './header/HeaderButton'
import { useFloatingRect } from './hooks/useFloatingRect'
import { DRAWER_DEFAULT_WIDTH, type PanelRect } from './panelGeometry'
import { ResizeHandles } from './FloatingPanel'
import { DEFAULT_SETTINGS } from './SessionSettings'
import { SubagentOpenContext } from './subagentOpen'
import { useConversationHistory } from './useConversationHistory'
import { useDrawerZoom } from './useDrawerZoom'
import { tr } from '../i18n'

// Rodando, o arquivo do subagente é relido a cada passo dele e, entre um e outro (o texto que ele
// escreve não vira aviso), neste intervalo. Parado, mais devagar: a conversa pode estar rodando no
// terminal, fora do app, sem aviso nenhum.
const POLL_RUNNING_MS = 1500
const POLL_IDLE_MS = 5000

const noop = () => {}

type Props = {
  project: ProjectData
  tint?: string
  subagent: SubagentRef
  rect: PanelRect | null
  onRectChange: (rect: PanelRect) => void
  // Os outros drawers à vista: este para encostado neles em vez de cobri-los.
  obstacles?: readonly PanelRect[]
  pinned: boolean
  onTogglePin: () => void
  // Volta para a conversa que lançou o subagente, no mesmo drawer.
  onBack: () => void
  // Subagente lançado por este subagente.
  onOpenSubagent: (subagent: SubagentRef) => void
  onOpenFile: (path: string, lines?: LineRange) => void
  onClose: () => void
}

// Drawer de um subagente: tudo o que ele recebeu, pensou, fez e entregou, como uma conversa, mas só
// para ler (sem a caixa de escrever). Fica no lugar do drawer da conversa, como outra conversa
// aberta; acompanha o subagente enquanto ele roda.
export function SubagentDrawer(props: Props) {
  const { project, tint, subagent, rect, pinned, onTogglePin, onBack, onClose } = props
  const zoom = useDrawerZoom()
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, rect, props.onRectChange, DRAWER_DEFAULT_WIDTH, props.obstacles)
  useEscape(onClose)

  // Outro subagente no mesmo drawer: o conteúdo entra com o efeito padrão, como ao trocar de conversa.
  const contentRef = useRef<HTMLDivElement>(null)
  const shown = useRef(subagent.toolUseId)
  useLayoutEffect(() => {
    if (shown.current === subagent.toolUseId) return
    shown.current = subagent.toolUseId
    if (reduced()) return
    contentRef.current?.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], MOTION.panel.in)
  }, [subagent.toolUseId])

  const running = useRunningAgent(subagent.toolUseId)
  const revision = useSubagentRevision(running)
  const history = useConversationHistory(project.path, subagent.sessionId, '', revision, subagent.toolUseId)
  const loaded = !history.loading && history.messages.length > 0
  const empty = running
    ? tr('Esperando o subagente começar…', 'Waiting for the subagent to start…')
    : tr('O histórico deste subagente não foi encontrado.', 'This subagent’s history wasn’t found.')

  const roots = project.folders ?? [project.path]
  const openFile = useStableCallback((path: string, lines?: LineRange) => {
    void locate(roots, path).then((found) => props.onOpenFile(found, lines))
  })
  const { sessionId } = subagent
  const openNested = useStableCallback((toolUseId: string, agent: string, description: string) =>
    props.onOpenSubagent({ sessionId, toolUseId, agent, description })
  )

  const headerStyle = useMemo<CSSProperties>(
    () => ({
      zoom,
      ...(tint && {
        background: `color-mix(in srgb, ${tint} 8%, var(--color-bg))`,
        borderBottomColor: `color-mix(in srgb, ${tint} 25%, var(--color-line))`
      })
    }),
    [zoom, tint]
  )

  return (
    <aside
      ref={panelRef}
      className="absolute z-40 flex flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-2xl shadow-black/50"
      style={{
        ...(rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : { visibility: 'hidden', inset: 0 }),
        ...(tint && {
          borderColor: `color-mix(in srgb, ${tint} 35%, var(--color-line))`,
          background: `color-mix(in srgb, ${tint} 3%, var(--color-bg))`,
          ...askColors(tint)
        })
      }}
    >
      <ResizeHandles onResizeStart={floating.onResizeStart} />
      <div ref={contentRef} className="flex min-h-0 w-full flex-1 flex-col">
        <SubagentHeader
          subagent={subagent}
          running={!!running}
          pinned={pinned}
          onTogglePin={onTogglePin}
          onBack={onBack}
          onClose={onClose}
          style={headerStyle}
          onPointerDown={floating.onMoveStart}
        />
        <FileLinkContext.Provider value={openFile}>
          <SubagentOpenContext.Provider value={openNested}>
            <div className="flex min-h-0 flex-1 flex-col" style={zoom === 1 ? undefined : { zoom }}>
              <ChatView
                key={subagent.toolUseId}
                draftKey={subagent.toolUseId}
                messages={history.messages}
                loading={history.loading}
                older={history.older}
                status={running ? 'running' : 'idle'}
                live={null}
                onSend={noop}
                onOpenMcp={noop}
                onOpenOutputStyle={noop}
                onRemoteControl={noop}
                onInterrupt={noop}
                onAnswer={noop}
                settings={DEFAULT_SETTINGS}
                onSettingChange={noop}
                contextPercent={0}
                readOnly
                emptyText={empty}
              />
            </div>
          </SubagentOpenContext.Provider>
        </FileLinkContext.Provider>
        {loaded && <SubagentFooter running={running} zoom={zoom} />}
      </div>
    </aside>
  )
}

// Linha do cabeçalho: voltar para a conversa, o agente e a tarefa, fixar e fechar.
function SubagentHeader({
  subagent,
  running,
  pinned,
  onTogglePin,
  onBack,
  onClose,
  style,
  onPointerDown
}: {
  subagent: SubagentRef
  running: boolean
  pinned: boolean
  onTogglePin: () => void
  onBack: () => void
  onClose: () => void
  style: CSSProperties
  onPointerDown: (e: PointerEvent) => void
}) {
  return (
    <header
      onPointerDown={onPointerDown}
      className="flex shrink-0 cursor-grab items-center gap-2 border-b border-line py-2.5 pl-2 pr-4 active:cursor-grabbing"
      style={style}
    >
      <div className="no-drag nodrag shrink-0">
        <HeaderButton label={tr('Voltar para a conversa', 'Back to the chat')} onClick={onBack}>
          <ArrowLeft size={15} />
        </HeaderButton>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm" title={subagent.description}>
        <Bot size={14} className={`shrink-0 ${running ? 'text-running' : 'text-muted'}`} />
        <span className="shrink-0 font-medium text-text">{subagent.agent}</span>
        {subagent.description && (
          <>
            <span className="shrink-0 text-faint">-</span>
            <span className="min-w-0 truncate text-muted">{subagent.description}</span>
          </>
        )}
      </div>
      <div className="no-drag nodrag flex shrink-0 items-center gap-1">
        <HeaderButton label={pinned ? tr('Desafixar', 'Unpin') : tr('Fixar', 'Pin')} onClick={onTogglePin} active={pinned}>
          {pinned ? <PinOff size={15} /> : <Pin size={15} />}
        </HeaderButton>
        <HeaderButton label={tr('Fechar', 'Close')} onClick={onClose}>
          <X size={15} />
        </HeaderButton>
      </div>
    </header>
  )
}

// No lugar da caixa de escrever: o que o subagente está fazendo agora e há quanto tempo, ou que terminou.
function SubagentFooter({ running, zoom }: { running?: RunningAgent; zoom: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-2.5 text-xs" style={{ zoom }}>
      <span className={`size-1.5 shrink-0 rounded-full ${running ? 'animate-pulse bg-running' : 'bg-emerald-400'}`} aria-hidden="true" />
      <span className="min-w-0 truncate text-muted">
        {running ? agentActivity(running) : tr('Terminou - só leitura', 'Finished - read only')}
      </span>
      {running && (
        <span className="ml-auto shrink-0 pl-2 tabular-nums text-faint">
          <Elapsed since={running.startedAt} />
        </span>
      )}
    </div>
  )
}

// Quando reler o arquivo do subagente: a cada passo dele (o progresso que chega pelo chat) e, entre
// um e outro, de tempos em tempos (ver POLL_RUNNING_MS). Os dois só sobem, então a soma muda sempre
// que qualquer um muda.
function useSubagentRevision(running: RunningAgent | undefined): number {
  const signal = running ? `${running.toolUses}|${running.steps.length}|${running.summary ?? ''}` : 'stopped'
  const [seen, setSeen] = useState({ signal, n: 0 })
  if (seen.signal !== signal) setSeen({ signal, n: seen.n + 1 })
  const [tick, setTick] = useState(0)
  const busy = !!running
  const bump = useCallback(() => setTick((n) => n + 1), [])
  useEffect(() => {
    const timer = setInterval(bump, busy ? POLL_RUNNING_MS : POLL_IDLE_MS)
    return () => clearInterval(timer)
  }, [busy, bump])
  return seen.n + tick
}
