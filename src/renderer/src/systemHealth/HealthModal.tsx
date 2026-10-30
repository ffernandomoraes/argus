import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { HealthEvent, MemoryLevel, DiskLevel, SystemHealthState } from '../../../shared/systemHealth'
import { TimeAgo } from '../canvas/blocks/TimeAgo'
import { displayPath } from '../canvas/factory'
import { useSessions } from '../canvas/sessionsStore'
import { tr } from '../i18n'
import { IS_MAC } from '../platform'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { severityOf } from './severity'
import { useSystemHealth } from './store'
import { diskText, formatGb, headline, memoryText } from './texts'

// Com o aviso aberto, os números são relidos neste intervalo (a barra só fica sabendo do nível).
const LIVE_MS = 5_000

const FILL: Record<MemoryLevel | DiskLevel, string> = { ok: 'bg-accent', low: 'bg-needs-you', tight: 'bg-danger', full: 'bg-danger' }

// O aviso da barra de cima aberto: quanto de memória e de disco o computador tem, o que isso afeta,
// o que já parou por falta deles e como liberar. "Entendi" tira da lista o que já foi visto.
export function HealthModal({ onClose }: { onClose: () => void }) {
  const stored = useSystemHealth()
  const [live, setLive] = useState<SystemHealthState | null>(null)
  useEffect(() => {
    let alive = true
    const read = () => void window.api.health.read().then((s) => alive && setLive(s))
    read()
    const timer = setInterval(read, LIVE_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])
  // Os eventos vêm do guardado (o "Entendi" de outra janela tira daqui também); os números, da leitura.
  const s = stored && live ? { ...live, events: stored.events } : (stored ?? live)
  if (!s) return null
  const critical = severityOf(s) === 'critical'
  const memoryShort = s.memory && s.memory.level !== 'ok'
  const diskShort = s.disk && s.disk.level !== 'ok'
  const done = () => {
    if (s.events.length) window.api.health.dismiss()
    onClose()
  }

  return (
    <Modal variant="alert" size="auto" className="w-[min(440px,calc(100vw-32px))]" labelledBy="health-title" onClose={onClose}>
      <div className="flex items-start gap-3">
        <TriangleAlert size={18} className={`mt-px shrink-0 ${critical ? 'text-danger' : 'text-needs-you'}`} aria-hidden="true" />
        <h2 id="health-title" className="min-w-0 text-sm font-semibold">
          {headline(s)}
        </h2>
      </div>

      {s.memory && (
        <Meter
          label={tr('Memória', 'Memory')}
          free={s.memory.availableBytes}
          total={s.memory.totalBytes}
          base={1024}
          level={s.memory.level}
          text={memoryText(s.memory.level)}
        />
      )}
      {s.disk && (
        <Meter
          label={tr('Disco', 'Disk')}
          free={s.disk.freeBytes}
          total={s.disk.totalBytes}
          base={IS_MAC ? 1000 : 1024}
          level={s.disk.level}
          text={diskText(s.disk.level)}
        />
      )}

      {s.events.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-medium">{tr('O que parou', 'What stopped')}</h3>
          <ul className="mt-1.5 flex flex-col gap-2">
            {[...s.events].reverse().map((e) => (e.cwd ? <ChatEventRow key={e.id} event={e} cwd={e.cwd} /> : <EventRow key={e.id} event={e} text={plainText(e)} />))}
          </ul>
        </section>
      )}

      {(memoryShort || diskShort) && (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          {[
            memoryShort && tr('Para liberar memória, feche programas e abas do navegador que não estiver usando.', "To free up memory, close apps and browser tabs you aren't using."),
            diskShort && tr('Para liberar espaço, apague arquivos grandes que não usa e esvazie a Lixeira.', "To free up space, delete large files you don't use and empty the Trash.")
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="primary" autoFocus onClick={done}>
          {tr('Entendi', 'OK')}
        </Button>
      </div>
    </Modal>
  )
}

// Memória ou disco: quanto está livre, a barra do que está em uso e o que isso afeta.
function Meter({ label, free, total, base, level, text }: { label: string; free: number; total: number; base: number; level: MemoryLevel | DiskLevel; text: string }) {
  const used = total > 0 ? Math.min(1, Math.max(0, 1 - free / total)) : 0
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">{tr(`${formatGb(free, base)} livres de ${formatGb(total, base)}`, `${formatGb(free, base)} free of ${formatGb(total, base)}`)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill">
        <div className={`h-full rounded-full ${FILL[level]}`} style={{ width: `${Math.round(used * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{text}</p>
    </div>
  )
}

function plainText(e: HealthEvent): string {
  return e.kind === 'windowCrashed'
    ? tr('A janela do canvas fechou por falta de memória.', 'The canvas window closed for lack of memory.')
    : tr('Não deu para salvar: disco cheio. Mudanças recentes podem não ter sido salvas.', "Couldn't save: disk full. Recent changes may not have been saved.")
}

// Conversa fechada ou Claude encerrado: com o título e a pasta da conversa.
function ChatEventRow({ event: e, cwd }: { event: HealthEvent; cwd: string }) {
  const path = displayPath(cwd)
  const sessions = useSessions(path)
  const title = sessions.find((c) => c.sessionId === e.sessionId)?.title ?? tr('Conversa', 'Chat')
  const folder = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
  const where = `“${title}” (${folder})`
  const text =
    e.kind === 'chatClosed'
      ? tr(
          `Fechada para liberar memória: ${where}. Nada se perdeu; a primeira resposta dela demora uns segundos a mais.`,
          `Closed to free up memory: ${where}. Nothing was lost; its first reply takes a few seconds longer.`
        )
      : e.busy
        ? tr(
            `O Claude parou por falta de memória no meio de uma resposta em ${where}. Abra a conversa para continuar de onde parou.`,
            `Claude stopped for lack of memory in the middle of a reply in ${where}. Open the chat to continue where it left off.`
          )
        : tr(
            `O Claude de ${where} foi encerrado por falta de memória, com a conversa parada. A próxima mensagem abre ele de novo.`,
            `Claude in ${where} was stopped for lack of memory while the chat was idle. Your next message starts it again.`
          )
  return <EventRow event={e} text={text} />
}

function EventRow({ event: e, text }: { event: HealthEvent; text: string }) {
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed">
      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-muted">{text}</span>
      <TimeAgo iso={new Date(e.at).toISOString()} className="mt-px" />
    </li>
  )
}
