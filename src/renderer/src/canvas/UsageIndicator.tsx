import { useEffect, useRef, useState } from 'react'
import { Panel } from '@xyflow/react'
import type { ClaudeAccount } from '../../../shared/auth'
import type { Usage, UsageWindow } from '../../../shared/usage'
import { useAuth } from '../auth/useAuth'
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

// Uso de cada conta logada; some quando a conta sai ou é removida.
function useUsages(): Record<string, Usage> {
  const [usages, setUsages] = useState<Record<string, Usage>>({})
  useEffect(() => {
    let alive = true
    window.api.usage.get().then((all) => alive && setUsages((u) => ({ ...all, ...u })))
    const off = window.api.usage.onUpdate((account, usage) =>
      setUsages((u) => {
        const next = { ...u }
        if (usage) next[account] = usage
        else delete next[account]
        return next
      })
    )
    return () => {
      alive = false
      off()
    }
  }, [])
  return usages
}

// Limites do Claude no canto do canvas. Com mais de uma conta, o botão mostra a sessão de cada
// uma, com o nome, e o painel traz sessão e semanal de todas.
export function UsageIndicator() {
  const usages = useUsages()
  const auth = useAuth()
  const [now, setNow] = useState(Date.now())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
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

  // Na ordem das configurações: a principal primeiro.
  const shown = (auth?.accounts ?? [])
    .map((account) => ({ account, usage: usages[account.id] }))
    .filter((x): x is { account: ClaudeAccount; usage: Usage } => !!x.usage?.session)
  if (!shown.length) return null
  const named = shown.length > 1
  const updatedAt = Math.max(...shown.map((x) => x.usage.updatedAt))

  return (
    <Panel position="bottom-left" className="!m-4">
      <div ref={ref} className="relative">
        {open && (
          <div className="absolute bottom-full left-0 mb-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-xl shadow-black/40">
            <div className="mb-4 flex items-center gap-2">
              <ClaudeIcon size={14} />
              <span className="text-xs font-medium text-text">Limites do Claude</span>
            </div>
            <div className="flex flex-col gap-5">
              {shown.map(({ account, usage }) => (
                <div key={account.id}>
                  {named && (
                    <div className="mb-3 truncate text-[10px] font-semibold uppercase tracking-widest text-faint">
                      {account.name}
                    </div>
                  )}
                  <div className="flex flex-col gap-4">
                    <WindowDetail title="Sessão (5 horas)" window={usage.session} now={now} />
                    <WindowDetail title="Semanal" window={usage.weekly} now={now} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-line pt-2 text-[10px] text-faint">
              Atualizado às {new Date(updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
          {shown.map(({ account, usage }, i) => {
            const percent = Math.round(usage.session!.percent)
            return (
              <span key={account.id} className="flex items-center gap-2">
                {i > 0 && <span>-</span>}
                {named && <span className="max-w-24 truncate">{account.name}</span>}
                <Bar percent={percent} className="h-1 w-10" />
                <span className="font-mono text-muted">{percent}%</span>
              </span>
            )
          })}
        </button>
      </div>
    </Panel>
  )
}
