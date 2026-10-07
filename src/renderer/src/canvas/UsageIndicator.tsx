import { useEffect, useRef, useState } from 'react'
import { Panel } from '@xyflow/react'
import type { Usage, UsageWindow } from '../../../shared/usage'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import { useEscape } from '../useEscape'

function timeLeft(resetsAt: string, now: number): string {
  const min = Math.max(0, Math.round((new Date(resetsAt).getTime() - now) / 60_000))
  if (min < 1) return 'menos de 1min'
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d > 0) return h === 0 ? `${d}d` : `${d}d ${h}h`
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function resetLabel(resetsAt: string): string {
  const date = new Date(resetsAt)
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const isToday = date.toDateString() === new Date().toDateString()
  if (isToday) return `hoje às ${time}`
  const day = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  return `${day.replace('.', '')} às ${time}`
}

function barColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 75) return 'bg-needs-you'
  return 'bg-muted'
}

function Bar({ percent, className }: { percent: number; className: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full rounded-full ${barColor(percent)}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  )
}

function WindowDetail({ title, window, now }: { title: string; window: UsageWindow | null; now: number }) {
  if (!window) {
    return (
      <div>
        <div className="text-xs text-text">{title}</div>
        <div className="mt-1 text-[11px] text-faint">Sem dados</div>
      </div>
    )
  }
  const percent = Math.round(window.percent)
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-text">{title}</span>
        <span className="font-mono text-xs text-text">{percent}%</span>
      </div>
      <Bar percent={percent} className="mt-1.5 h-1.5 w-full" />
      <div className="mt-1.5 text-[11px] text-faint">
        Reseta em {timeLeft(window.resetsAt, now)} - {resetLabel(window.resetsAt)}
      </div>
    </div>
  )
}

export function UsageIndicator() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [now, setNow] = useState(Date.now())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.usage.get().then((u) => u && setUsage(u))
    const off = window.api.usage.onUpdate(setUsage)
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      off()
      clearInterval(tick)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  useEscape(() => setOpen(false), open)

  const session = usage?.session
  if (!session) return null
  const percent = Math.round(session.percent)

  return (
    <Panel position="bottom-left" className="!m-4">
      <div ref={ref} className="relative">
        {open && (
          <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-line bg-surface p-4 shadow-xl shadow-black/40">
            <div className="mb-4 flex items-center gap-2">
              <ClaudeIcon size={14} />
              <span className="text-xs font-medium text-text">Limites do Claude</span>
            </div>
            <div className="flex flex-col gap-4">
              <WindowDetail title="Sessão (5 horas)" window={session} now={now} />
              <WindowDetail title="Semanal" window={usage.weekly} now={now} />
            </div>
            <div className="mt-4 border-t border-line pt-2 text-[10px] text-faint">
              Atualizado às{' '}
              {new Date(usage.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
        <button
          aria-label="Ver limites do Claude"
          onClick={() => setOpen((o) => !o)}
          className={`flex h-[34px] items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[10px] text-faint shadow-md shadow-black/20 hover:text-muted ${
            open ? 'text-muted' : ''
          }`}
        >
          <ClaudeIcon size={12} />
          <Bar percent={percent} className="h-1 w-10" />
          <span className="font-mono text-muted">{percent}%</span>
        </button>
      </div>
    </Panel>
  )
}
