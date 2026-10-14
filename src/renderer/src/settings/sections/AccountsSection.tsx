import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { MAIN_ACCOUNT } from '../../../../shared/auth'
import { LoginPanel } from '../../auth/LoginPanel'
import { useAuth } from '../../auth/useAuth'
import { ConfirmDialog, type ConfirmRequest } from '../../canvas/ConfirmDialog'
import { Presence } from '../../motion'
import { THIS_COMPUTER } from '../../platform'
import { AccountCard } from '../accounts/AccountCard'
import { ProviderSection } from '../accounts/ProviderSection'
import { usePreference } from '../preferences'
import { useProviders } from '../../providers/useProviders'
import { PROVIDERS } from '../../../../shared/providers'
import { tr } from '../../i18n'

// Contas do Claude Code. A principal é a do terminal e do VS Code: entrar e sair nela valem para o
// Mac todo. As outras ficam só no Argus, cada uma com a pasta e o login dela, e cada grupo do
// canvas escolhe a sua.
export function AccountsSection() {
  const auth = useAuth()
  const multiAgents = usePreference('multiAgents')
  const providers = useProviders()
  // Login aberto aqui: numa conta da lista ou numa nova (adding).
  const [target, setTarget] = useState<{ accountId?: string } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const login = auth?.login

  // Abrir a seção confere de novo: o login pode ter mudado fora do app.
  useEffect(() => {
    window.api.auth.refresh()
  }, [])

  useEffect(() => {
    if (multiAgents) window.api.providers.refresh()
  }, [multiAgents])

  // Login terminou ou foi cancelado: volta para a lista.
  const status = login?.status
  const [prevStatus, setPrevStatus] = useState(status)
  if (status !== prevStatus) {
    setPrevStatus(status)
    if ((prevStatus === 'starting' || prevStatus === 'waiting') && status === 'idle') setTarget(null)
  }

  if (!auth || !login) return <p className="text-xs text-faint">{tr('Conferindo as contas…', 'Checking accounts…')}</p>

  // Login em andamento, mesmo que tenha começado na tela de boas-vindas.
  const active = login.status !== 'idle' ? { accountId: login.adding ? undefined : login.accountId } : target
  if (active) {
    const account = active.accountId ? auth.accounts.find((a) => a.id === active.accountId) : undefined
    return (
      <div className="max-w-sm">
        <p className="mb-4 text-xs leading-relaxed text-faint">
          {!account
            ? tr(
                'Entre com a outra conta. Ela fica só no Argus: o terminal e o VS Code continuam com a principal.',
                'Sign in with the other account. It stays in Argus only: the terminal and VS Code keep the main one.'
              )
            : account.id === MAIN_ACCOUNT
              ? tr(
                  `Entre com a conta que vai ficar no lugar da principal, ou com a mesma para renovar o acesso. Vale também para o terminal e o VS Code ${THIS_COMPUTER}.`,
                  `Sign in with the account that will replace the main one, or with the same one to renew access. This also applies to the terminal and VS Code ${THIS_COMPUTER}.`
                )
              : tr(
                  `Entre com a conta que vai ficar no lugar de ${account.name}, ou com a mesma para renovar o acesso.`,
                  `Sign in with the account that will replace ${account.name}, or with the same one to renew access.`
                )}
        </p>
        <LoginPanel
          login={login}
          onStart={(method) => (account ? window.api.auth.login(account.id, method) : window.api.auth.add(method))}
          onCancel={() => setTarget(null)}
        />
      </div>
    )
  }

  const multiple = auth.accounts.length > 1
  return (
    <>
      <p className="mb-4 text-xs leading-relaxed text-faint">
        {multiple
          ? tr(
              'Cada grupo do canvas usa uma conta: botão direito no grupo > Conta do Claude. Fora de grupo vale a padrão. Histórico, CLAUDE.md, agentes, skills, plugins e configurações são os mesmos em todas; o login e os MCPs são de cada conta.',
              'Each canvas group uses one account: right-click the group > Claude account. Outside groups, the default one is used. History, CLAUDE.md, agents, skills, plugins and settings are shared by all; login and MCPs belong to each account.'
            )
          : tr(
              'Para usar outra conta em alguns grupos (uma pessoal e uma da empresa, por exemplo), adicione aqui. A principal continua sendo a do terminal e do VS Code.',
              'To use another account in some groups (a personal one and a work one, for example), add it here. The main one is still the one used by the terminal and VS Code.'
            )}
      </p>
      <div className="flex flex-col gap-3">
        {auth.accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            auth={auth}
            onLogin={() => setTarget({ accountId: account.id })}
            onConfirm={setConfirm}
          />
        ))}
      </div>
      <button
        onClick={() => setTarget({})}
        className="mt-3 flex items-center gap-1.5 rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text"
      >
        <Plus size={13} />
        {tr('Adicionar conta', 'Add account')}
      </button>
      {multiAgents && providers && PROVIDERS.map((p) => <ProviderSection key={p} provider={p} state={providers} onConfirm={setConfirm} />)}
      <Presence kind="modal">{confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}</Presence>
    </>
  )
}
