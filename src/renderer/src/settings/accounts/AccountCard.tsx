import { useState, type ReactNode } from 'react'
import type { AuthState, ClaudeAccount } from '../../../../shared/auth'
import type { ConfirmRequest } from '../../canvas/ConfirmDialog'
import { IS_WIN, THIS_COMPUTER } from '../../platform'
import { Button } from '../../ui/Button'
import { AccountName } from './AccountName'
import { accountSummary } from './accountSummary'
import { CopyTerminalCommand } from './CopyTerminalCommand'
import { tr } from '../../i18n'

function Badge({ children }: { children: ReactNode }) {
  return <span className="shrink-0 rounded-full border border-line px-1.5 py-px text-[11px] text-faint">{children}</span>
}

export function AccountCard({
  account,
  auth,
  onLogin,
  onConfirm
}: {
  account: ClaudeAccount
  auth: AuthState
  onLogin: () => void
  onConfirm: (req: ConfirmRequest) => void
}) {
  const [logoutFailed, setLogoutFailed] = useState(false)
  const { multiple, main, isDefault, loggedIn, external, who, footer, fallback } = accountSummary(account, auth)
  const s = account.status

  return (
    <div className="overflow-hidden rounded-xl bg-fill">
      <div className="flex items-center gap-3 p-4">
        {/* Avatar com a inicial, no cinza das contas do macOS. */}
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
          style={{ background: 'linear-gradient(180deg, #a1a1a6, #6e6e73)' }}
        >
          {account.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <AccountName account={account} />
            {multiple && main && <Badge>{tr('Principal', 'Main')}</Badge>}
            {multiple && isDefault && <Badge>{tr('Padrão', 'Default')}</Badge>}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {s === null
              ? tr('O Claude Code não respondeu.', 'Claude Code did not respond.')
              : loggedIn
                ? who
                : tr('Entre para usar esta conta.', 'Sign in to use this account.')}
          </div>
        </div>
        {/* À direita, no meio da altura do cartão. */}
        {s && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-px text-[11px] ${
              loggedIn ? 'bg-done/15 text-done' : 'bg-needs-you/15 text-needs-you'
            }`}
          >
            <span className={`size-1.5 rounded-full ${loggedIn ? 'bg-done' : 'bg-needs-you'}`} />
            {loggedIn ? tr('Conectada', 'Connected') : main ? tr('Sem login', 'Signed out') : tr('Desconectada', 'Disconnected')}
          </span>
        )}
      </div>

      {/* Rodapé: organização e plano à esquerda, as ações alinhadas no fim; sair ou remover por último. */}
      <div className="border-t border-line px-4 py-2.5">
        {external ? (
          <p className="text-xs leading-relaxed text-faint">
            {tr(
              'O acesso vem das variáveis de ambiente ou das configurações do Claude Code, não de um login. Para trocar, mude por lá.',
              'Access comes from environment variables or Claude Code settings, not from a login. To switch, change it there.'
            )}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto min-w-0 truncate text-xs text-faint">{footer}</span>
            {/* Desconectada, só cabe reconectar ou remover: o terminal e o padrão esperam o login. */}
            {loggedIn && account.dir && <CopyTerminalCommand dir={account.dir} />}
            {loggedIn && multiple && !isDefault && <Button onClick={() => window.api.auth.setDefault(account.id)}>{tr('Usar como padrão', 'Use as default')}</Button>}
            {/* Conectada, o login serve para pôr outra conta no lugar desta (ou renovar o acesso). */}
            <Button onClick={onLogin} title={loggedIn ? tr('Entra com outra conta no lugar desta, ou renova o acesso', 'Sign in with another account in place of this one, or renew access') : undefined}>
              {loggedIn ? tr('Trocar conta', 'Switch account') : main ? tr('Entrar', 'Sign in') : tr('Reconectar', 'Reconnect')}
            </Button>
            {main
              ? loggedIn && (
                  <Button
                    danger
                    onClick={() =>
                      onConfirm({
                        title: tr('Sair da conta?', 'Sign out?'),
                        description: tr(
                          `O Claude Code ${THIS_COMPUTER} sai de ${who}, inclusive no terminal e no VS Code. Conversas trabalhando agora terminam o pedido atual.`,
                          `Claude Code ${THIS_COMPUTER} signs out of ${who}, including in the terminal and VS Code. Chats working right now finish their current request.`
                        ),
                        confirmLabel: tr('Sair', 'Sign out'),
                        onConfirm: () => void window.api.auth.logout().then((ok) => setLogoutFailed(!ok))
                      })
                    }
                  >
                    {tr('Sair', 'Sign out')}
                  </Button>
                )
              : (
                  <Button
                    danger
                    onClick={() =>
                      onConfirm({
                        title: tr(`Remover "${account.name}"?`, `Remove "${account.name}"?`),
                        description: tr(
                          `O Argus sai dessa conta e apaga a pasta dela. Conversas e terminais abertos com ela fecham agora, e os grupos que usavam ela passam a usar ${fallback ?? 'a padrão'}. O histórico das conversas continua.`,
                          `Argus signs out of this account and deletes its folder. Chats and terminals open with it close now, and groups that used it switch to ${fallback ?? 'the default one'}. Chat history is kept.`
                        ),
                        confirmLabel: tr('Remover', 'Remove'),
                        onConfirm: () => void window.api.auth.remove(account.id)
                      })
                    }
                  >
                    {tr('Remover', 'Remove')}
                  </Button>
                )}
          </div>
        )}
        {logoutFailed && (
          <p role="alert" className="mt-2 text-right text-xs text-red-400">
            {tr(
              `Não deu para sair. Tente de novo ou rode "claude auth logout" no ${IS_WIN ? 'PowerShell' : 'Terminal'}.`,
              `Could not sign out. Try again or run "claude auth logout" in ${IS_WIN ? 'PowerShell' : 'Terminal'}.`
            )}
          </p>
        )}
      </div>
    </div>
  )
}
