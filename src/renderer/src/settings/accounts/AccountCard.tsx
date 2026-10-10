import { useState, type ReactNode } from 'react'
import type { AuthState, ClaudeAccount } from '../../../../shared/auth'
import type { ConfirmRequest } from '../../canvas/ConfirmDialog'
import { IS_WIN, THIS_COMPUTER } from '../../platform'
import { Button } from '../../ui/Button'
import { AccountName } from './AccountName'
import { accountSummary } from './accountSummary'
import { CopyTerminalCommand } from './CopyTerminalCommand'

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
            {multiple && main && <Badge>Principal</Badge>}
            {multiple && isDefault && <Badge>Padrão</Badge>}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {s === null ? 'O Claude Code não respondeu.' : loggedIn ? who : 'Entre para usar esta conta.'}
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
            {loggedIn ? 'Conectada' : 'Sem login'}
          </span>
        )}
      </div>

      {/* Rodapé: organização e plano à esquerda, as ações alinhadas no fim; sair ou remover por último. */}
      <div className="border-t border-line px-4 py-2.5">
        {external ? (
          <p className="text-xs leading-relaxed text-faint">
            O acesso vem das variáveis de ambiente ou das configurações do Claude Code, não de um login. Para trocar,
            mude por lá.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto min-w-0 truncate text-xs text-faint">{footer}</span>
            {account.dir && <CopyTerminalCommand dir={account.dir} />}
            {multiple && !isDefault && <Button onClick={() => window.api.auth.setDefault(account.id)}>Usar como padrão</Button>}
            {/* Conectada, o login serve para pôr outra conta no lugar desta (ou renovar o acesso). */}
            <Button onClick={onLogin} title={loggedIn ? 'Entra com outra conta no lugar desta, ou renova o acesso' : undefined}>
              {loggedIn ? 'Trocar conta' : 'Entrar'}
            </Button>
            {main
              ? loggedIn && (
                  <Button
                    danger
                    onClick={() =>
                      onConfirm({
                        title: 'Sair da conta?',
                        description: `O Claude Code ${THIS_COMPUTER} sai de ${who}, inclusive no terminal e no VS Code. Conversas trabalhando agora terminam o pedido atual.`,
                        confirmLabel: 'Sair',
                        onConfirm: () => void window.api.auth.logout().then((ok) => setLogoutFailed(!ok))
                      })
                    }
                  >
                    Sair
                  </Button>
                )
              : (
                  <Button
                    danger
                    onClick={() =>
                      onConfirm({
                        title: `Remover "${account.name}"?`,
                        description: `O Argus sai dessa conta e apaga a pasta dela. Conversas e terminais abertos com ela fecham agora, e os grupos que usavam ela passam a usar ${fallback ?? 'a padrão'}. O histórico das conversas continua.`,
                        confirmLabel: 'Remover',
                        onConfirm: () => void window.api.auth.remove(account.id)
                      })
                    }
                  >
                    Remover
                  </Button>
                )}
          </div>
        )}
        {logoutFailed && (
          <p role="alert" className="mt-2 text-right text-xs text-red-400">
            Não deu para sair. Tente de novo ou rode "claude auth logout" no {IS_WIN ? 'PowerShell' : 'Terminal'}.
          </p>
        )}
      </div>
    </div>
  )
}
