import { memo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ActiveChat } from '../../../shared/chat'
import { Elapsed } from '../conversation/Elapsed'
import { activityLabel } from '../conversation/timeline/activityLabel'
import { Presence } from '../motion'
import { MenuArrow } from '../ui/MenuArrow'
import { MENU_HOVER, MENU_PANEL, MENU_ROW } from '../ui/menuStyles'
import { useOutsideClick } from '../useOutsideClick'
import { useActiveChats } from './activeChats'
import { displayPath } from './factory'
import { untildify } from '../platform'
import { useFinishedChats, useSessions, type FinishedChat } from './sessionsStore'
import { StatusDot } from './StatusBadge'
import { tr } from '../i18n'

// Pílula no canto inferior esquerdo enquanto alguma conversa do app trabalha, espera você ou
// terminou sem você ver (bolinha verde): mostra quantas de cada, e o clique abre a lista com cada
// uma. Clicar numa linha abre a conversa (a concluída sai da lista ao ser vista).
export const RunningIndicator = memo(function RunningIndicator({
  hidden,
  onOpen
}: {
  // Interface oculta (⌘\): some junto com as barras do canvas.
  hidden: boolean
  onOpen: (cwd: string, sessionId: string) => void
}) {
  const chats = useActiveChats()
  const finished = useFinishedChats()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  const empty = !chats.length && !finished.length
  // Tudo visto: na próxima vez a pílula volta fechada.
  if (empty && open) setOpen(false)
  if (hidden || empty) return null

  const waiting = chats.filter((c) => c.status === 'needs-you').length
  const working = chats.length - waiting
  const done = finished.length
  // Um estado por linha, cada um com a sua bolinha: a pílula fica estreita.
  const lines = [
    { status: 'needs-you', n: waiting, text: tr(`${waiting} precisa${waiting > 1 ? 'm' : ''} de você`, `${waiting} need${waiting > 1 ? '' : 's'} you`) },
    { status: 'running', n: working, text: tr(`${working} trabalhando`, `${working} working`) },
    { status: 'done', n: done, text: tr(`${done} concluído${done > 1 ? 's' : ''}`, `${done} done`) }
  ] as const
  const pick = (cwd: string, sessionId: string) => {
    setOpen(false)
    onOpen(cwd, sessionId)
  }

  return (
    <div ref={ref} className="absolute bottom-4 left-4 z-20 flex flex-col items-start gap-2.5">
      <Presence kind="menu">
        {open && (
          <div className={`relative w-80 ${MENU_PANEL}`}>
            <MenuArrow side="bottom" />
            <ul className="max-h-[50vh] overflow-y-auto">
              {chats.map((c) => (
                <ActiveRow key={c.key} chat={c} onOpen={() => pick(c.cwd, c.sessionId ?? c.key)} />
              ))}
              {finished.map((c) => (
                <FinishedRow key={c.id} chat={c} onOpen={() => pick(untildify(c.path), c.id)} />
              ))}
            </ul>
          </div>
        )}
      </Presence>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-line bg-surface/90 px-2.5 py-1.5 text-xs shadow-xl shadow-black/40 backdrop-blur-xl hover:bg-fill"
      >
        <span className="flex flex-col gap-1">
          {lines
            .filter((l) => l.n > 0)
            .map((l) => (
              <span key={l.status} className="flex items-center gap-2">
                <StatusDot status={l.status} />
                {l.text}
              </span>
            ))}
        </span>
        {open ? <ChevronDown size={13} className="text-faint" /> : <ChevronUp size={13} className="text-faint" />}
      </button>
    </div>
  )
})

// Uma conversa: título e pasta; embaixo, o que ela está fazendo e há quanto tempo.
function ActiveRow({ chat: c, onOpen }: { chat: ActiveChat; onOpen: () => void }) {
  const path = displayPath(c.cwd)
  const sessions = useSessions(path)
  const title = sessions.find((s) => s.id === c.sessionId)?.title ?? tr('Conversa nova', 'New chat')
  const folder = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
  // Pedido já terminado: só o que ficou em segundo plano roda.
  const turnDone = c.status === 'running' && c.turnStartedAt === undefined && !c.activity && c.background > 0
  const doing =
    c.status === 'needs-you' ? tr('Precisa de você', 'Needs you') : turnDone ? '' : activityLabel(c.activity, c.foregroundAgents)
  const line = [doing, c.background > 0 && tr(`${c.background} em segundo plano`, `${c.background} in background`)].filter(Boolean).join(' - ')

  return (
    <li>
      <button onClick={onOpen} className={`${MENU_ROW} ${MENU_HOVER} !items-start !py-1.5`}>
        <span className="mt-[5px] flex">
          <StatusDot status={c.status} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate">{title}</span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{folder}</span>
          </span>
          <span className="truncate text-[11px] text-faint">
            {line}
            {c.turnStartedAt !== undefined && (
              <>
                {' - '}
                <Elapsed since={c.turnStartedAt} />
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

// Conversa que terminou sem você ver: título, pasta e "Concluído".
function FinishedRow({ chat: c, onOpen }: { chat: FinishedChat; onOpen: () => void }) {
  const folder = c.path.split(/[\\/]/).filter(Boolean).at(-1) ?? c.path
  return (
    <li>
      <button onClick={onOpen} className={`${MENU_ROW} ${MENU_HOVER} !items-start !py-1.5`}>
        <span className="mt-[5px] flex">
          <StatusDot status="done" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate">{c.title}</span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{folder}</span>
          </span>
          <span className="truncate text-[11px] text-faint">{tr('Concluído', 'Done')}</span>
        </span>
      </button>
    </li>
  )
}
