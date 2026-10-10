import type { ClaudeAccount } from '../../../../shared/auth'
import type { Usage, UsageWindow } from '../../../../shared/usage'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import { useNow } from '../../lib/clock'
import { MenuArrow } from '../../ui/MenuArrow'
import { UsageBar } from './UsageBar'
import { resetLabel, timeLeft } from './usageFormat'

function WindowDetail({ title, window, now }: { title: string; window: UsageWindow | null; now: number }) {
  if (!window) {
    return (
      <div>
        <div className="text-xs text-text">{title}</div>
        <div className="mt-1 text-[12px] text-faint">Sem dados</div>
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
      <UsageBar percent={percent} className="mt-1.5 h-1.5 w-full" />
      <div className="mt-1.5 text-[12px] text-faint">
        Reseta em {timeLeft(window.resetsAt, now)} - {resetLabel(window.resetsAt, now)}
      </div>
    </div>
  )
}

// Painel dos limites, aberto pelo botão da barra de título: sessão e semanal de cada conta.
// Só existe aberto, e só então acompanha o relógio (a cada 30 s, o mesmo timer para a janela toda).
export function UsagePanel({ shown }: { shown: { account: ClaudeAccount; usage: Usage }[] }) {
  const now = useNow(30_000)
  const named = shown.length > 1
  const updatedAt = Math.max(...shown.map((x) => x.usage.updatedAt))

  return (
    // A rolagem fica num filho: a caixa não corta a seta, que vaza para fora dela.
    <div className="absolute right-0 top-full mt-2.5 w-72 origin-top-right rounded-2xl border border-line bg-surface/90 shadow-xl shadow-black/40 backdrop-blur-xl">
      <MenuArrow side="top" align="end" />
      <div className="max-h-[70vh] overflow-y-auto p-4 text-left">
        <div className="mb-4 flex items-center gap-2">
          <ClaudeIcon size={14} />
          <span className="text-xs font-medium text-text">Limites do Claude</span>
        </div>
        <div className="flex flex-col gap-5">
          {shown.map(({ account, usage }) => (
            <div key={account.id}>
              {named && (
                <div className="mb-3 truncate text-[11px] font-semibold uppercase tracking-widest text-faint">
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
        <div className="mt-4 border-t border-line pt-2 text-[11px] text-faint">
          Atualizado às {new Date(updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
