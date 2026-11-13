import { PROVIDER_NAMES, type ProviderId } from '../../../../shared/providers'
import { expiredUsage, type Usage, type UsageWindow } from '../../../../shared/usage'
import { AgentIcon } from '../../icons/AgentIcon'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import { useNow } from '../../lib/clock'
import { Button } from '../../ui/Button'
import { MenuArrow } from '../../ui/MenuArrow'
import { UsageBar } from './UsageBar'
import { resetLabel, staleText, timeLeft, windowTitle } from './usageFormat'
import { LOCALE, tr } from '../../i18n'

// Uma conta com limites à vista: do Claude (sem provider) ou de outro agente (hoje, só o Codex).
// key: a mesma do aviso de uso ("main", "codex:main", "wsl:ubuntu:main"). place: onde vale esse uso
// quando não é o login comum da conta ("WSL", "WSL (Ubuntu)"). note: um aviso da conta, abaixo das
// janelas dela (o login dela no WSL é o de outra conta do app). endings: o login da conta (ou o dela
// numa distro do WSL) está perto do prazo final (ver auth/loginEnd.ts), em destaque e com o botão de
// entrar de novo.
export type ShownUsage = { key: string; provider?: ProviderId; name: string; place?: string; usage: Usage; note?: string; endings?: LoginEnding[] }

// Aviso de prazo final de um login, com o que o botão precisa para entrar de novo.
export type LoginEnding = { text: string; account: string; distro?: string }

// Conta do Claude que perdeu o login (ver lostLogin): fica na barra, sem números, com o botão de entrar.
export type SignedOutLogin = { key: string; name: string; account: string }

// note: o texto no lugar da barra quando a janela não existe na conta (não é falta de dado).
type Row = { title: string; window: UsageWindow | null; note?: string }

// Linhas de uma conta. As do Claude têm rótulo fixo (sessão de 5 horas e semanal, que aparece mesmo
// sem dados); na conta sem sessão (Ultra verificado), a linha da sessão diz que não há limite. As dos outros agentes vêm da duração que cada janela informa, e só as que existem: o
// plano free do Codex tem uma janela só, de 30 dias.
// A janela que já recomeçou fica sem número até a leitura nova (ver usableUsage), e a linha diz isso.
function rowsOf({ provider, usage }: ShownUsage): Row[] {
  const restarted = tr('Recomeçou, aguardando a próxima leitura', 'Restarted, waiting for the next reading')
  if (!provider) {
    return [
      {
        title: tr('Sessão (5 horas)', 'Session (5 hours)'),
        window: usage.session,
        note: usage.noSession ? tr('Sem limite neste plano', 'No limit on this plan') : usage.restarted?.session ? restarted : undefined
      },
      { title: tr('Semanal', 'Weekly'), window: usage.weekly, note: usage.restarted?.weekly ? restarted : undefined },
      ...usage.models.map((m) => ({ title: tr(`Semanal ${m.name}`, `Weekly ${m.name}`), window: m.window }))
    ]
  }
  const windows = [usage.session, usage.weekly].filter((w): w is UsageWindow => !!w)
  const rows = [
    ...windows.map((w) => ({ title: windowTitle(w.minutes), window: w })),
    ...usage.models.map((m) => ({ title: `${m.name} - ${windowTitle(m.window.minutes)}`, window: m.window }))
  ]
  // A duração da janela foi junto com ela: sem nenhuma outra, uma linha só com o aviso.
  if (!rows.length && usage.restarted) return [{ title: windowTitle(), window: null, note: restarted }]
  return rows
}

// "O Gemini não informa os limites." / "Gemini e Cursor não informam os limites."
function silentNote(silent: ProviderId[]): string {
  const names = silent.map((p) => PROVIDER_NAMES[p])
  if (names.length === 1) return tr(`O ${names[0]} não informa os limites.`, `${names[0]} doesn’t report its limits.`)
  const list = `${names.slice(0, -1).join(', ')} ${tr('e', 'and')} ${names[names.length - 1]}`
  return tr(`${list} não informam os limites.`, `${list} don’t report their limits.`)
}

function WindowDetail({ title, window, note, now }: Row & { now: number }) {
  if (!window) {
    return (
      <div>
        <div className="text-xs text-text">{title}</div>
        <div className="mt-1 text-[12px] text-faint">{note ?? tr('Sem dados', 'No data')}</div>
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
// signedOut: contas que perderam o login, depois das com números. onLogin: entrar de novo numa conta
// (ou no login dela numa distro do WSL), pelo aviso no meio da janela (ver auth/LoginModal.tsx).
export function UsagePanel({
  shown,
  silent,
  signedOut = [],
  onLogin
}: {
  shown: ShownUsage[]
  silent: ProviderId[]
  signedOut?: SignedOutLogin[]
  onLogin: (account: string, distro?: string) => void
}) {
  const now = useNow(30_000)
  const mixed = shown.some((x) => x.provider)
  const named = shown.length + signedOut.length > 1 || mixed || shown.some((x) => x.place)
  // A leitura mais antiga das contas à vista: o rodapé nunca diz mais novo do que é.
  const updatedAt = shown.length ? Math.min(...shown.map((x) => x.usage.updatedAt)) : now
  const updatedTime = new Date(updatedAt).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
  const updatedToday = new Date(updatedAt).toDateString() === new Date(now).toDateString()
  const saved = shown.some((x) => x.usage.saved)

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
          {shown.map((entry) => {
            const expired = expiredUsage(entry.usage, now)
            const stale = staleText(entry.usage, expired)
            return (
              <div key={entry.key}>
                {named && (
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-faint">
                    {mixed && <AgentIcon provider={entry.provider} size={12} />}
                    <span className="truncate">{entry.place ? `${entry.name} - ${entry.place}` : entry.name}</span>
                    {entry.usage.saved && <span className="shrink-0 normal-case tracking-normal font-normal">- {tr('guardado', 'saved')}</span>}
                  </div>
                )}
                {!expired && (
                  <div className={`flex flex-col gap-4 ${entry.usage.saved || entry.usage.failure ? 'opacity-60' : ''}`}>
                    {rowsOf(entry).map((row) => (
                      <WindowDetail key={row.title} {...row} now={now} />
                    ))}
                  </div>
                )}
                {stale && <div className={`text-[12px] text-needs-you ${expired ? '' : 'mt-3'}`}>{stale}</div>}
                {entry.endings?.map((e) => (
                  <div key={`${e.account}-${e.distro ?? ''}`} className="mt-3 flex flex-col items-start gap-2">
                    <span className="text-[12px] text-needs-you">{e.text}</span>
                    <Button size="sm" onClick={() => onLogin(e.account, e.distro)}>
                      {tr('Entrar de novo', 'Sign in again')}
                    </Button>
                  </div>
                ))}
                {entry.note && <div className="mt-3 text-[12px] text-faint">{entry.note}</div>}
              </div>
            )
          })}
          {signedOut.map((entry) => (
            <div key={entry.key}>
              {named && (
                <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-faint">
                  <span className="truncate">{entry.name}</span>
                </div>
              )}
              <div className="flex flex-col items-start gap-2">
                <span className="text-[12px] text-needs-you">
                  {tr(
                    'Sem login: as conversas desta conta não respondem até você entrar de novo.',
                    'Signed out: chats on this account won’t respond until you sign in again.'
                  )}
                </span>
                <Button size="sm" onClick={() => onLogin(entry.account)}>
                  {tr('Entrar', 'Sign in')}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t border-line pt-2 text-[11px] text-faint">
          {silent.length > 0 && <span>{silentNote(silent)}</span>}
          {saved && (
            <span>
              {tr(
                'Último uso guardado, da abertura anterior. Conferindo de novo.',
                'Last saved usage, from the previous launch. Checking again.'
              )}
            </span>
          )}
          {shown.length > 0 && (
            <span>
              {updatedToday
                ? tr(`Atualizado às ${updatedTime}`, `Updated at ${updatedTime}`)
                : tr(`Atualizado ${resetLabel(new Date(updatedAt).toISOString(), now)}`, `Updated ${resetLabel(new Date(updatedAt).toISOString(), now)}`)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
