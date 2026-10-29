import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, Pin, PinOff, SquareTerminal, X } from 'lucide-react'
import { useBackgroundTaskList, type BackgroundTask } from '../canvas/backgroundTasks'
import type { TaskRef, TasksRef } from '../canvas/CanvasContext'
import { mergeTasks, type TaskItem as Item } from './taskList'
import type { ProjectData } from '../canvas/types'
import { MOTION, reduced } from '../motion'
import { useEscape } from '../useEscape'
import { askColors } from './askColors'
import { Elapsed } from './Elapsed'
import { HeaderButton } from './header/HeaderButton'
import { useFloatingRect } from './hooks/useFloatingRect'
import { DRAWER_DEFAULT_WIDTH, type PanelRect } from './panelGeometry'
import { ResizeHandles } from './FloatingPanel'
import { TaskOutputView } from './TaskOutputView'
import { useDrawerZoom } from './useDrawerZoom'
import { tr } from '../i18n'

type Props = {
  project: ProjectData
  tint?: string
  tasks: TasksRef
  rect: PanelRect | null
  onRectChange: (rect: PanelRect) => void
  obstacles?: readonly PanelRect[]
  pinned: boolean
  onTogglePin: () => void
  // Volta para a conversa que lançou as tarefas, no mesmo drawer.
  onBack: () => void
  onClose: () => void
}


// Drawer das tarefas em segundo plano de uma conversa: uma aba por tarefa e a saída da escolhida
// num terminal só para ler. Fica no lugar do drawer da conversa, como o do subagente. A que termina
// continua na aba enquanto o drawer está aberto, marcada como terminada.
export function TasksDrawer(props: Props) {
  const { project, tint, tasks, rect, pinned, onTogglePin, onBack, onClose } = props
  const zoom = useDrawerZoom()
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, rect, props.onRectChange, DRAWER_DEFAULT_WIDTH, props.obstacles)
  useEscape(onClose)

  const running = useBackgroundTaskList(tasks.sessionId)
  const items = useSeenTasks(running, tasks.extra)
  const [selected, setSelected] = useSelected(tasks.selected)
  const current = items.find((t) => t.id === selected) ?? items[0]
  const runningIds = useMemo(() => new Set(running.map((t) => t.id)), [running])

  // Outra tarefa à vista: a saída entra com o efeito padrão, como ao trocar de conversa.
  const contentRef = useRef<HTMLDivElement>(null)
  const shown = useRef(current?.id)
  useLayoutEffect(() => {
    if (shown.current === current?.id) return
    shown.current = current?.id
    if (reduced()) return
    contentRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], MOTION.panel.in)
  }, [current?.id])

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
      <header
        onPointerDown={floating.onMoveStart}
        className="flex shrink-0 cursor-grab items-center gap-2 border-b border-line py-2.5 pl-2 pr-4 active:cursor-grabbing"
        style={headerStyle}
      >
        <div className="no-drag nodrag shrink-0">
          <HeaderButton label={tr('Voltar para a conversa', 'Back to the chat')} onClick={onBack}>
            <ArrowLeft size={15} />
          </HeaderButton>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <SquareTerminal size={14} className={`shrink-0 ${runningIds.size ? 'text-running' : 'text-muted'}`} />
          <span className="truncate font-medium text-text">{tr('Tarefas em segundo plano', 'Background tasks')}</span>
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

      {items.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-2 py-1.5" style={{ zoom }}>
          {items.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              title={t.command ?? t.description}
              className={`flex max-w-56 shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
                t.id === current?.id ? 'bg-selection text-text' : 'text-muted hover:bg-fill hover:text-text'
              }`}
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${runningIds.has(t.id) ? 'animate-pulse bg-running' : 'bg-line-strong'}`}
                aria-hidden="true"
              />
              <span className="truncate">{taskTitle(t)}</span>
            </button>
          ))}
        </div>
      )}

      <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
        {current ? (
          <>
            <TaskLine task={current} running={runningIds.has(current.id)} zoom={zoom} />
            <TaskOutputView
              key={current.id}
              task={{ cwd: project.path, sessionId: tasks.sessionId, taskId: current.id, outputFile: current.outputFile }}
              running={runningIds.has(current.id)}
              fontScale={zoom}
            />
          </>
        ) : (
          <div className="m-auto px-6 text-center text-xs text-faint">
            {tr('Nenhuma tarefa em segundo plano agora.', 'No background tasks right now.')}
          </div>
        )}
      </div>
    </aside>
  )
}

// Em cima da saída: a tarefa (o comando inteiro, quando se sabe) e se ainda roda.
function TaskLine({ task, running, zoom }: { task: Item; running: boolean; zoom: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2 text-xs" style={{ zoom }}>
      <span className={`size-1.5 shrink-0 rounded-full ${running ? 'animate-pulse bg-running' : 'bg-emerald-400'}`} aria-hidden="true" />
      <span className={`min-w-0 truncate ${task.command ? 'font-mono text-text' : 'text-muted'}`} title={task.command ?? task.description}>
        {task.command ?? taskTitle(task)}
      </span>
      <span className="ml-auto shrink-0 pl-2 tabular-nums text-faint">
        {running && task.startedAt !== undefined ? <Elapsed since={task.startedAt} /> : running ? '' : tr('Terminou', 'Finished')}
      </span>
    </div>
  )
}

const taskTitle = (t: Item) => t.description || t.command || t.id

// As tarefas que passaram pelo drawer enquanto ele está aberto: as rodando agora (com o que se sabe
// delas), mais a aberta pelo chat. As que terminam ficam, para a saída não sumir da tela.
function useSeenTasks(running: BackgroundTask[], extra: TaskRef | undefined): Item[] {
  const [seen, setSeen] = useState<Item[]>([])
  const next = mergeTasks(seen, running, extra)
  if (next !== seen) setSeen(next)
  return next
}

// A aba escolhida; abrir de novo pedindo outra tarefa (pelo chat) troca para ela.
function useSelected(asked: string | undefined): [string | undefined, (id: string) => void] {
  const [state, setState] = useState({ asked, selected: asked })
  if (state.asked !== asked) setState({ asked, selected: asked ?? state.selected })
  const select = (id: string) => setState((s) => ({ ...s, selected: id }))
  return [asked !== state.asked ? asked : state.selected, select]
}
