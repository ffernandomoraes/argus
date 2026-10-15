import { PROVIDER_NAMES, type ProviderId } from '../../../../shared/providers'
import type { Usage, UsageWindow } from '../../../../shared/usage'
import { AgentIcon } from '../../icons/AgentIcon'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import { useNow } from '../../lib/clock'
import { MenuArrow } from '../../ui/MenuArrow'
import { UsageBar } from './UsageBar'
import { resetLabel, timeLeft, windowTitle } from './usageFormat'
import { LOCALE, tr } from '../../i18n'

// Uma conta com limites à vista: do Claude (sem provider) ou de outro agente (hoje, só o Codex).
// key: a mesma do aviso de uso ("main", "codex:main").
export type ShownUsage = { key: string; provider?: ProviderId; name: string; usage: Usage }

type Row = { title: string; window: UsageWindow | null }

// Linhas de uma conta. As do Claude têm rótulo fixo (sessão de 5 horas e semanal, que aparece mesmo
// sem dados). As dos outros agentes vêm da duração que cada janela informa, e só as que existem: o
// plano free do Codex tem uma janela só, de 30 dias.
function rowsOf({ provider, usage }: ShownUsage): Row[] {
  if (!provider) {
    return [
      { title: tr('Sessão (5 horas)', 'Session (5 hours)'), window: usage.session },
      { title: tr('Semanal', 'Weekly'), window: usage.weekly },
      ...usage.models.map((m) => ({ title: tr(`Semanal ${m.name}`, `Weekly ${m.name}`), window: m.window }))
    ]
  }
  const windows = [usage.session, usage.weekly].filter((w): w is UsageWindow => !!w)
  return [
    ...windows.map((w) => ({ title: windowTitle(w.minutes), window: w })),
    ...usage.models.map((m) => ({ title: `${m.name} - ${windowTitle(m.window.minutes)}`, window: m.window }))
  ]
}

// "O Gemini não informa os limites." / "Gemini e Cursor não informam os limites."
function silentNote(silent: ProviderId[]): string {
  const names = silent.map((p) => PROVIDER_NAMES[p])
  if (names.length === 1) return tr(`O ${names[0]} não informa os limites.`, `${names[0]} doesn’t report its limits.`)
  const list = `${names.slice(0, -1).join(', ')} ${tr('e', 'and')} ${names[names.length - 1]}`
  return tr(`${list} não informam os limites.`, `${list} don’t report their limits.`)
}

function WindowDetail({ title, window, now }: { title: string; window: UsageWindow | null; now: number }) {
  if (!window) {
    return (
      <div>
        <div className="text-xs text-text">{title}</div>
        <div className="mt-1 text-[12px] text-faint">{tr('Sem dados', 'No data')}</div>
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
        {window.resetsAt
          ? tr(
              `Reseta em ${timeLeft(window.resetsAt, now)} - ${resetLabel(window.resetsAt, now)}`,
              `Resets in ${timeLeft(window.resetsAt, now)} - ${resetLabel(window.resetsAt, now)}`
            )
          : tr('Começa a contar na próxima mensagem', 'Starts counting on the next message')}
      </div>
    </div>
  )
}

// Painel dos limites, aberto pelo botão da barra de baixo (abre para cima): as janelas de cada conta. Só com o
// Claude, fica como sempre foi; com conta de outro agente, cada conta leva o logo do agente.
// silent: agentes com conta logada que não informam limite (Gemini, Cursor): uma linha no rodapé,
// sem número inventado.
// Só existe aberto, e só então acompanha o relógio (a cada 30 s, o mesmo timer para a janela toda).
export function UsagePanel({ shown, silent }: { shown: ShownUsage[]; silent: ProviderId[] }) {
  const now = useNow(30_000)
  const mixed = shown.some((x) => x.provider)
  const named = shown.length > 1 || mixed
  const updatedAt = Math.max(...shown.map((x) => x.usage.updatedAt))
  const updatedTime = new Date(updatedAt).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })

  return (
    // A rolagem fica num filho: a caixa não corta a seta, que vaza para fora dela.
    <div className="absolute right-0 bottom-full mb-2.5 w-72 origin-bottom-right rounded-2xl border border-line bg-surface/90 shadow-xl shadow-black/40 backdrop-blur-xl">
      {/* Depois da curva do canto (rounded-2xl, 16px): no padrão, a seta caía em cima dela. */}
      <MenuArrow side="bottom" align="end" at={30} />
      <div className="max-h-[70vh] overflow-y-auto p-4 text-left">
        <div className="mb-4 flex items-center gap-2">
          {!mixed && <ClaudeIcon size={14} />}
          <span className="text-xs font-medium text-text">
            {mixed ? tr('Limites de uso', 'Usage limits') : tr('Limites do Claude', 'Claude limits')}
          </span>
        </div>
        <div className="flex flex-col gap-5">
          {shown.map((entry) => (
            <div key={entry.key}>
              {named && (
                <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-faint">
                  {mixed && <AgentIcon provider={entry.provider} size={12} />}
                  <span className="truncate">{entry.name}</span>
                </div>
              )}
              <div className="flex flex-col gap-4">
                {rowsOf(entry).map((row) => (
                  <WindowDetail key={row.title} title={row.title} window={row.window} now={now} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t border-line pt-2 text-[11px] text-faint">
          {silent.length > 0 && <span>{silentNote(silent)}</span>}
          <span>{tr(`Atualizado às ${updatedTime}`, `Updated at ${updatedTime}`)}</span>
        </div>
      </div>
    </div>
  )
}
