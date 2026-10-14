import { Loader2, Plus } from 'lucide-react'
import {
  MAIN_PROVIDER_ACCOUNT,
  PROVIDER_NAMES,
  type ProviderAccount,
  type ProviderId,
  type ProviderInstall,
  type ProvidersState
} from '../../../../shared/providers'
import type { ConfirmRequest } from '../../canvas/ConfirmDialog'
import { IS_WIN } from '../../platform'
import { Button } from '../../ui/Button'
import { ExperimentTag } from '../../ui/ExperimentTag'
import { AgentIcon } from '../../icons/AgentIcon'
import { AccountName } from './AccountName'
import { ProviderLoginPanel } from './ProviderLoginPanel'
import { tr } from '../../i18n'

// Como cada agente entra, numa frase.
const HOW: Record<ProviderId, string> = {
  codex: tr('Entra com a conta do ChatGPT, pelo navegador. Pode ter várias.', 'Signs in with your ChatGPT account, in the browser. You can have several.'),
  gemini: tr(
    'Usa uma chave do Google AI Studio. O login com a conta Google não é usado: o Google suspende contas que fazem isso fora do Gemini CLI.',
    'Uses a Google AI Studio key. Google sign-in isn’t used: Google suspends accounts that do it outside the Gemini CLI.'
  ),
  cursor: tr(
    'A primeira conta é a do terminal, pelo navegador. As outras usam chave de API, para uma não trocar a outra.',
    'The first account is the terminal one, in the browser. Others use an API key, so one doesn’t replace the other.'
  )
}

export function ProviderSection({
  provider,
  state,
  onConfirm
}: {
  provider: ProviderId
  state: ProvidersState
  onConfirm: (req: ConfirmRequest) => void
}) {
  const { install, accounts, defaultId } = state.providers[provider]
  const name = PROVIDER_NAMES[provider]
  const login = state.login.status !== 'idle' && state.login.provider === provider ? state.login : null
  // Login de outro agente em andamento: um de cada vez (o do Codex usa uma porta fixa).
  const busyElsewhere = state.login.status !== 'idle' && !login

  return (
    <section className="mt-8">
      <div className="mb-1 flex items-center gap-2">
        <AgentIcon provider={provider} size={15} />
        <h3 className="text-sm font-medium text-text">{name}</h3>
        <ExperimentTag />
      </div>
      <p className="mb-3 text-xs leading-relaxed text-faint">{HOW[provider]}</p>

      {install.status !== 'found' ? (
        <InstallCard provider={provider} state={install} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {accounts.map((account) => (
              <ProviderAccountCard
                key={account.id}
                account={account}
                multiple={accounts.length > 1}
                isDefault={account.id === defaultId}
                onConfirm={onConfirm}
                disabled={busyElsewhere || !!login}
              />
            ))}
            {login && <ProviderLoginPanel login={login} />}
          </div>
          {!login && (
            <button
              disabled={busyElsewhere}
              onClick={() => window.api.providers.add(provider)}
              className="mt-3 flex items-center gap-1.5 rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
            >
              <Plus size={13} />
              {accounts.length ? tr('Adicionar conta', 'Add account') : tr(`Conectar o ${name}`, `Connect ${name}`)}
            </button>
          )}
        </>
      )}
    </section>
  )
}

function InstallCard({ provider, state }: { provider: ProviderId; state: ProviderInstall }) {
  const name = PROVIDER_NAMES[provider]
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-fill p-4">
      {state.status === 'installing' ? (
        <div className="flex items-center gap-2 text-sm text-text">
          <Loader2 size={14} className="animate-spin text-muted" />
          {tr(`Instalando o ${name}…`, `Installing ${name}…`)}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted">
            {state.status === 'failed'
              ? tr(`A instalação do ${name} não deu certo.`, `${name} installation failed.`)
              : tr(`O ${name} não está instalado neste computador.`, `${name} isn’t installed on this computer.`)}
          </p>
          <Button variant="primary" onClick={() => window.api.providers.install(provider)}>
            {state.status === 'failed' ? tr('Tentar de novo', 'Try again') : tr('Instalar', 'Install')}
          </Button>
        </div>
      )}
      {state.status === 'failed' && (
        <>
          {state.message && <pre className="whitespace-pre-wrap text-[11px] text-red-400">{state.message}</pre>}
          <p className="text-xs text-faint">
            {tr(`Ou rode no ${IS_WIN ? 'PowerShell' : 'Terminal'}:`, `Or run in ${IS_WIN ? 'PowerShell' : 'Terminal'}:`)}{' '}
            <code className="select-text text-muted">{state.command}</code>
          </p>
        </>
      )}
    </div>
  )
}

function ProviderAccountCard({
  account,
  multiple,
  isDefault,
  disabled,
  onConfirm
}: {
  account: ProviderAccount
  multiple: boolean
  isDefault: boolean
  disabled: boolean
  onConfirm: (req: ConfirmRequest) => void
}) {
  const s = account.status
  const signedIn = !!s?.signedIn
  const main = account.id === MAIN_PROVIDER_ACCOUNT
  const name = PROVIDER_NAMES[account.provider]
  const who = s?.email ?? (s?.keyHint ? tr(`Chave ${s.keyHint}`, `Key ${s.keyHint}`) : undefined)

  return (
    <div className="overflow-hidden rounded-xl bg-fill">
      <div className="flex items-center gap-3 p-4">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
          style={{ background: 'linear-gradient(180deg, #a1a1a6, #6e6e73)' }}
        >
          {account.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <AccountName account={account} onRename={(n) => window.api.providers.rename(account.provider, account.id, n)} />
            {multiple && isDefault && <Badge>{tr('Padrão', 'Default')}</Badge>}
            {main && <Badge>{tr('Terminal', 'Terminal')}</Badge>}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {s === null
              ? tr(`O ${name} não respondeu.`, `${name} did not respond.`)
              : signedIn
                ? [who, s.plan].filter(Boolean).join(' - ')
                : tr('Entre para usar esta conta.', 'Sign in to use this account.')}
          </div>
        </div>
        {s && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-px text-[11px] ${
              signedIn ? 'bg-done/15 text-done' : 'bg-needs-you/15 text-needs-you'
            }`}
          >
            <span className={`size-1.5 rounded-full ${signedIn ? 'bg-done' : 'bg-needs-you'}`} />
            {signedIn ? tr('Conectada', 'Connected') : tr('Sem login', 'Signed out')}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-2.5">
        {multiple && !isDefault && (
          <Button disabled={disabled} onClick={() => window.api.providers.setDefault(account.provider, account.id)}>
            {tr('Usar como padrão', 'Use as default')}
          </Button>
        )}
        <Button disabled={disabled} onClick={() => window.api.providers.login(account.provider, account.id)}>
          {account.kind === 'key'
            ? tr('Trocar chave', 'Replace key')
            : signedIn
              ? tr('Entrar de novo', 'Sign in again')
              : tr('Entrar', 'Sign in')}
        </Button>
        <Button
          danger
          disabled={disabled}
          onClick={() =>
            onConfirm({
              title: tr(`Remover "${account.name}"?`, `Remove "${account.name}"?`),
              description: main
                ? tr(
                    `A conta sai do Argus, mas continua logada no ${name} do terminal.`,
                    `The account leaves Argus, but stays signed in to ${name} in the terminal.`
                  )
                : tr(
                    'O Argus apaga o login (ou a chave) e a pasta dessa conta. Conversas abertas com ela fecham.',
                    'Argus deletes this account’s sign-in (or key) and folder. Chats open with it close.'
                  ),
              confirmLabel: tr('Remover', 'Remove'),
              onConfirm: () => window.api.providers.remove(account.provider, account.id)
            })
          }
        >
          {tr('Remover', 'Remove')}
        </Button>
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full border border-line px-1.5 py-px text-[11px] text-faint">{children}</span>
}
