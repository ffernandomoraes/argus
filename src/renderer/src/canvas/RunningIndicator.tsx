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
import { useSessions } from './sessionsStore'
import { StatusDot } from './StatusBadge'

// Pílula no canto inferior esquerdo enquanto alguma conversa do app trabalha ou espera você: mostra
// quantas, e o clique abre a lista com cada uma. Clicar numa linha abre a conversa.
export const RunningIndicator = memo(function RunningIndicator({
  hidden,
  onOpen
}: {
  // Interface oculta (⌘\): some junto com as barras do canvas.
  hidden: boolean
  onOpen: (cwd: string, sessionId: string) => void
}) {
  const chats = useActiveChats()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  // Tudo terminou: na próxima vez a pílula volta fechada.
  if (!chats.length && open) setOpen(false)
  if (hidden || !chats.length) return null

  const waiting = chats.filter((c) => c.status === 'needs-you').length
  const running = chats.length - waiting
  const summary = [running && `${running} rodando`, waiting && `${waiting} precisa${waiting > 1 ? 'm' : ''} de você`]
    .filter(Boolean)
    .join(' - ')

  return (
    <div ref={ref} className="absolute bottom-4 left-4 z-20 flex flex-col items-start gap-2.5">
      <Presence kind="menu">
        {open && (
          <div className={`relative w-80 ${MENU_PANEL}`}>
            <MenuArrow side="bottom" />
            <ul className="max-h-[50vh] overflow-y-auto">
              {chats.map((c) => (
                <ActiveRow
                  key={c.key}
                  chat={c}
                  onOpen={() => {
                    setOpen(false)
                    onOpen(c.cwd, c.sessionId ?? c.key)
                  }}
                />
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
        <StatusDot status={waiting ? 'needs-you' : 'running'} />
        <span>{summary}</span>
        {open ? <ChevronDown size={13} className="text-faint" /> : <ChevronUp size={13} className="text-faint" />}
      </button>
    </div>
  )
})

// Uma conversa: título e pasta; embaixo, o que ela está fazendo e há quanto tempo.
function ActiveRow({ chat: c, onOpen }: { chat: ActiveChat; onOpen: () => void }) {
  const path = displayPath(c.cwd)
  const sessions = useSessions(path)
  const title = sessions.find((s) => s.id === c.sessionId)?.title ?? 'Conversa nova'
  const folder = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
  const doing = c.status === 'needs-you' ? 'Precisa de você' : activityLabel(c.activity, c.foregroundAgents)

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
            {doing}
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
