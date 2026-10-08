import { useState, type ReactNode } from 'react'
import { Check, CheckCircle2, Circle, Copy, Loader2 } from 'lucide-react'
import { MAIN_ACCOUNT, type AuthState, type ClaudeInstall } from '../../../shared/auth'
import { LoginPanel } from '../auth/LoginPanel'
import { IS_WIN } from '../platform'

const GIT_URL = 'https://git-scm.com/download/win'

// Pronto para começar: Claude Code instalado e nenhuma conta confirmada sem login. Conta que não
// respondeu (null) não trava a pessoa aqui; é a mesma regra do App para abrir o canvas. O Git
// falta só avisa.
export function setupReady(auth: AuthState): boolean {
  const loggedOut = !!auth.accounts.length && auth.accounts.every((a) => a.status?.loggedIn === false)
  return auth.claude.status === 'found' && !loggedOut
}

// Uma linha da lista: feito (verde), em andamento ou pendente, com a ação embaixo quando falta.
function Item({ state, title, detail, children }: { state: 'done' | 'busy' | 'todo'; title: string; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line py-3 last:border-0">
      <span className="mt-0.5 shrink-0">
        {state === 'done' ? (
          <CheckCircle2 size={16} className="text-done" />
        ) : state === 'busy' ? (
          <Loader2 size={16} className="animate-spin text-muted" />
        ) : (
          <Circle size={16} className="text-faint" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text">{title}</div>
        {detail && <div className="mt-0.5 text-xs leading-relaxed text-faint">{detail}</div>}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}

const BUTTON = 'flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm disabled:opacity-50'
const PRIMARY = `${BUTTON} bg-accent font-medium text-white hover:brightness-110`
const SECONDARY = `${BUTTON} border border-line text-text hover:bg-surface-2`

// Comando do instalador para rodar na mão, com botão de copiar.
function Command({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-bg px-2.5 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-text" title={command}>
        {command}
      </code>
      <button onClick={copy} aria-label="Copiar comando" title="Copiar comando" className="shrink-0 rounded p-1 text-muted hover:bg-surface-2 hover:text-text">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  )
}

// Claude Code: um clique roda o instalador oficial. Se falhar, o erro e o comando para o terminal.
function ClaudeItem({ claude }: { claude: ClaudeInstall }) {
  if (claude.status === 'found') return <Item state="done" title="Claude Code" detail="Instalado." />
  if (claude.status === 'installing') {
    return <Item state="busy" title="Claude Code" detail="Instalando… pode levar um minuto, conforme a internet." />
  }
  const failed = claude.status === 'failed'
  return (
    <Item
      state="todo"
      title="Claude Code"
      detail={failed ? 'Não deu para instalar.' : 'Ainda não está instalado. O instalador é o oficial da Anthropic e fica na sua pasta de usuário.'}
    >
      {failed && claude.message && (
        <pre className="mb-3 max-h-24 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-bg px-2.5 py-1.5 font-mono text-[12px] text-red-400">
          {claude.message}
        </pre>
      )}
      <button onClick={() => window.api.auth.install()} className={PRIMARY}>
        {failed ? 'Tentar de novo' : 'Instalar Claude Code'}
      </button>
      {failed && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-faint">Ou rode no {IS_WIN ? 'PowerShell' : 'Terminal'} e confira de novo:</p>
          <Command command={claude.command} />
        </div>
      )}
    </Item>
  )
}

export function SetupStep({ auth }: { auth: AuthState }) {
  const claudeOk = auth.claude.status === 'found'
  const checking = claudeOk && auth.accounts.some((a) => a.status === null)
  const account = auth.accounts.find((a) => a.status?.loggedIn)
  const busy = auth.claude.status === 'installing'

  return (
    <div className="flex flex-col">
      <ClaudeItem claude={auth.claude} />
      {IS_WIN && (
        <Item
          state={auth.claude.git ? 'done' : 'todo'}
          title="Git for Windows"
          detail={auth.claude.git ? 'Instalado.' : 'O Claude Code usa o Git para rodar comandos no Windows. Instale e confira de novo.'}
        >
          {!auth.claude.git && (
            <button onClick={() => window.api.auth.open(GIT_URL)} className={SECONDARY}>
              Baixar o Git
            </button>
          )}
        </Item>
      )}
      {account ? (
        <Item state="done" title="Sua conta" detail={account.status?.email ?? account.name} />
      ) : !claudeOk ? (
        <Item state="todo" title="Sua conta" detail="Depois de instalar o Claude Code." />
      ) : checking ? (
        <Item state="busy" title="Sua conta" detail="Conferindo o login…" />
      ) : (
        <Item state="todo" title="Sua conta" detail="Entre com sua assinatura do Claude ou pague pelo uso da API.">
          <LoginPanel login={auth.login} onStart={(method) => window.api.auth.login(MAIN_ACCOUNT, method)} />
        </Item>
      )}
      {!busy && !(claudeOk && account && auth.claude.git) && (
        <button onClick={() => window.api.auth.refresh()} className="mt-3 self-start text-xs text-muted underline hover:text-text">
          Já instalei - conferir de novo
        </button>
      )}
    </div>
  )
}
