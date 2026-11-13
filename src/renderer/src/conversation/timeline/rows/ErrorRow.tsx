import { useState } from 'react'
import { parseAgentRef } from '../../../../../shared/providers'
import { LoginModal, startRelogin, type ReloginTarget } from '../../../auth/LoginModal'
import { needsLogin } from '../../../auth/needsLogin'
import { findAccount, useAuth, useConversationAccount, useConversationFolder } from '../../../auth/useAuth'
import { tr } from '../../../i18n'
import { wslDistroOf } from '../../../platform'
import { Button } from '../../../ui/Button'

// Erro que encerrou o pedido. Quando é falta de login, vem com o botão de entrar na conta da
// conversa, no lugar onde ela roda: numa pasta do WSL cuja distro tem login próprio (a conta traz
// essa distro em `wsl`), o login é o de lá; nas outras, é o login comum da conta. Um clique abre o
// navegador (ver LoginModal); entrou de novo, o botão vira "Reenviar", que manda a mesma mensagem.
// loginNeeded: o Claude Code marcou o pedido como recusado por falta de login (ChatState.loginNeeded).
// onResend: manda de novo a mensagem que falhou; sem ele (conversa só de leitura), não há o botão.
export function ErrorRow({ error, loginNeeded, onResend }: { error: string; loginNeeded?: boolean; onResend?: () => void }) {
  const auth = useAuth()
  const accountId = useConversationAccount()
  const folder = useConversationFolder()
  const [target, setTarget] = useState<ReloginTarget | null>(null)
  const [resent, setResent] = useState(false)
  // Conta de outro agente (Codex, Gemini, Cursor) entra pela tela de contas.
  const account = (loginNeeded || needsLogin(error)) && !parseAgentRef(accountId) ? findAccount(auth, accountId) : undefined
  const folderDistro = folder ? wslDistroOf(folder) : undefined
  const there = folderDistro ? account?.wsl?.find((w) => w.distro.toLowerCase() === folderDistro.toLowerCase()) : undefined
  const distro = there ? folderDistro : undefined
  // O login que a conversa usa: o da distro, se ela tem login próprio; senão, o da conta.
  const status = there ? there.status : account?.status

  // Entrou de novo depois do erro (aqui, nas Configurações ou no terminal): o "Entrar" vira
  // "Reenviar". Só depois de ver este login sem login, ou de um login começado aqui terminar com ele
  // logado: logo depois do erro, a conferência da conta ainda pode não ter voltado, e ela segue
  // aparecendo como logada por um instante. A conversa que passou para outra conta (o selo do
  // cabeçalho) também ganha o "Reenviar", se a conta nova estiver logada.
  const key = account ? `${account.id}\0${distro ?? ''}` : ''
  const [firstKey] = useState(key)
  const [outKey, setOutKey] = useState(status?.loggedIn === false ? key : null)
  if (status?.loggedIn === false && outKey !== key) setOutKey(key)
  const loginStatus = auth?.login.status
  const [prevLogin, setPrevLogin] = useState(loginStatus)
  const [loggedHere, setLoggedHere] = useState(false)
  if (loginStatus !== prevLogin) {
    setPrevLogin(loginStatus)
    if (target && (prevLogin === 'starting' || prevLogin === 'waiting') && loginStatus === 'idle') setLoggedHere(true)
  }
  const switched = !!account && key !== firstKey
  const back = !!status?.loggedIn && (outKey === key || loggedHere || switched)

  if (!account || !auth) return <p className="py-0.5 text-[13px] text-red-400">{error}</p>

  const multiple = auth.accounts.length > 1
  return (
    <div className="py-0.5">
      <p className="text-[13px] text-red-400">{error}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        {back ? (
          <>
            <span>
              {switched
                ? tr(`A conversa agora usa a conta ${account.name}.`, `The chat now uses the ${account.name} account.`)
                : multiple
                  ? tr(`Pronto, a conta ${account.name} entrou de novo.`, `Done, the ${account.name} account is signed in again.`)
                  : tr('Pronto, o Claude entrou de novo.', 'Done, Claude is signed in again.')}
            </span>
            {onResend && (
              <Button
                size="sm"
                disabled={resent}
                onClick={() => {
                  setResent(true)
                  onResend()
                }}
              >
                {tr('Reenviar', 'Resend')}
              </Button>
            )}
          </>
        ) : (
          <>
            <span>
              {distro
                ? multiple
                  ? tr(`A conta ${account.name} está sem login no WSL (${distro}).`, `The ${account.name} account is signed out in WSL (${distro}).`)
                  : tr(`O Claude está sem login no WSL (${distro}).`, `Claude is signed out in WSL (${distro}).`)
                : multiple
                  ? tr(`A conta ${account.name} está sem login.`, `The ${account.name} account is signed out.`)
                  : tr('O Claude está sem login.', 'Claude is signed out.')}
            </span>
            <Button size="sm" onClick={() => setTarget(startRelogin(auth, account, distro))}>
              {tr('Entrar', 'Sign in')}
            </Button>
          </>
        )}
      </div>
      <LoginModal
        target={target}
        note={distro ? tr(`O login das pastas do WSL (${distro}) é separado do login do Windows.`, `Sign-in for WSL (${distro}) folders is separate from the Windows one.`) : undefined}
        onClose={() => setTarget(null)}
      />
    </div>
  )
}
