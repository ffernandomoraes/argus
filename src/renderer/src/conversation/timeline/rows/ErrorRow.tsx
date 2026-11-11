import { useState } from 'react'
import { createPortal } from 'react-dom'
import { parseAgentRef } from '../../../../../shared/providers'
import { LoginPanel } from '../../../auth/LoginPanel'
import { findAccount, useAuth, useConversationAccount, useConversationFolder } from '../../../auth/useAuth'
import { tr } from '../../../i18n'
import { Presence } from '../../../motion'
import { wslDistroOf } from '../../../platform'
import { Button } from '../../../ui/Button'
import { Modal } from '../../../ui/Modal'

// O que o Claude Code responde quando a conta da conversa está sem login ("Not logged in · Please
// run /login", "Invalid API key · Please run /login"...). O /login dele não existe aqui dentro.
const NEEDS_LOGIN = /not logged in|please run \/login/i

// Erro que encerrou o pedido. Quando é falta de login, vem com o botão de entrar na conta da
// conversa, no lugar onde ela roda: numa pasta do WSL, o login é o de lá, separado do do Windows.
export function ErrorRow({ error }: { error: string }) {
  const auth = useAuth()
  const accountId = useConversationAccount()
  const folder = useConversationFolder()
  const [open, setOpen] = useState(false)
  // Conta de outro agente (Codex, Gemini, Cursor) entra pela tela de contas.
  const account = NEEDS_LOGIN.test(error) && !parseAgentRef(accountId) ? findAccount(auth, accountId) : undefined
  const distro = folder ? wslDistroOf(folder) : undefined
  const login = auth?.login

  // Login terminou: o aviso fecha, e a próxima mensagem já vai com o login novo.
  const status = login?.status
  const [prevStatus, setPrevStatus] = useState(status)
  if (status !== prevStatus) {
    setPrevStatus(status)
    if ((prevStatus === 'starting' || prevStatus === 'waiting') && status === 'idle') setOpen(false)
  }

  if (!account || !login) return <p className="py-0.5 text-[13px] text-red-400">{error}</p>

  const multiple = (auth?.accounts.length ?? 0) > 1
  return (
    <div className="py-0.5">
      <p className="text-[13px] text-red-400">{error}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <span>
          {distro
            ? multiple
              ? tr(`A conta ${account.name} está sem login no WSL (${distro}).`, `The ${account.name} account is signed out in WSL (${distro}).`)
              : tr(`O Claude está sem login no WSL (${distro}).`, `Claude is signed out in WSL (${distro}).`)
            : multiple
              ? tr(`A conta ${account.name} está sem login.`, `The ${account.name} account is signed out.`)
              : tr('O Claude está sem login.', 'Claude is signed out.')}
        </span>
        <Button size="sm" onClick={() => setOpen(true)}>
          {tr('Entrar', 'Sign in')}
        </Button>
      </div>
      {/* No body: dentro da conversa, o modal ficava preso ao painel dela em vez de centrar na janela. */}
      {createPortal(
        <Presence kind="modal">
          {open && (
          <Modal variant="alert" labelledBy="chat-login-title" onClose={() => setOpen(false)} onRequestClose={() => (window.api.auth.cancel(), true)}>
            <h2 id="chat-login-title" className="text-sm font-semibold">
              {distro ? tr(`Entrar no WSL (${distro})`, `Sign in to WSL (${distro})`) : tr('Entrar no Claude', 'Sign in to Claude')}
            </h2>
            <p className="mb-4 mt-2 text-xs leading-relaxed text-muted">
              {distro
                ? tr(
                    'O login das pastas do WSL é separado do login do Windows. Depois de entrar, envie a mensagem de novo.',
                    'Sign-in for WSL folders is separate from the Windows one. After signing in, send the message again.'
                  )
                : tr('Depois de entrar, envie a mensagem de novo.', 'After signing in, send the message again.')}
            </p>
            <LoginPanel login={login} onStart={(method) => window.api.auth.login(account.id, method, distro)} onCancel={() => setOpen(false)} />
          </Modal>
          )}
        </Presence>,
        document.body
      )}
    </div>
  )
}
