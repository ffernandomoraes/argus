import { useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { MAIN_ACCOUNT, type ClaudeInstall, type LoginState } from '../../../shared/auth'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import { IS_WIN } from '../platform'
import { LoginPanel } from './LoginPanel'

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
    <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-text" title={command}>
        {command}
      </code>
      <button
        onClick={copy}
        aria-label="Copiar comando"
        title="Copiar comando"
        className="shrink-0 rounded p-1 text-muted hover:bg-surface-2 hover:text-text"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  )
}

// Sem o Claude Code na máquina: um clique roda o instalador oficial. Se falhar, o erro e o mesmo
// comando para rodar no terminal.
function InstallPanel({ claude }: { claude: ClaudeInstall }) {
  const installing = claude.status === 'installing'
  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          disabled={installing}
          onClick={() => window.api.auth.install()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-text px-3 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
        >
          {installing && <Loader2 size={14} className="animate-spin" />}
          {installing ? 'Instalando…' : claude.status === 'failed' ? 'Tentar de novo' : 'Instalar Claude Code'}
        </button>
        <p className="mt-1.5 text-center text-xs text-faint">
          {installing ? 'Pode levar um minuto, conforme a internet.' : 'Instalador oficial da Anthropic, na sua pasta de usuário.'}
        </p>
      </div>
      {claude.status === 'failed' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-red-400">Não deu para instalar.</p>
          {claude.message && (
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-muted">
              {claude.message}
            </pre>
          )}
          <p className="text-xs leading-relaxed text-faint">
            Rode o instalador no {IS_WIN ? 'PowerShell' : 'Terminal'} e depois confira de novo:
          </p>
          <Command command={claude.command} />
        </div>
      )}
      {!installing && (
        <button onClick={() => window.api.auth.refresh()} className="text-xs text-muted underline hover:text-text">
          Já instalei - conferir de novo
        </button>
      )}
    </div>
  )
}

// Sem login no Claude Code, o app abre nesta tela no lugar do canvas, como a extensão do VS Code.
// Antes do login, se for o caso, a instalação do próprio Claude Code.
export function WelcomeScreen({ login, claude }: { login: LoginState; claude: ClaudeInstall }) {
  const install = claude.status !== 'found'
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-bg p-6">
      {/* Faixa de cima continua arrastando a janela, como a barra de título. */}
      <div className="drag absolute inset-x-0 top-0 h-10" />
      <div className="flex w-[min(360px,100%)] flex-col">
        <ClaudeIcon size={32} />
        <h1 className="mt-5 text-lg font-semibold">{install ? 'Instale o Claude Code' : 'Entre no Claude Code'}</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">
          {install
            ? 'O Argus usa o Claude Code para conversar, abrir terminais e mostrar o uso da sua conta, e ele ainda não está instalado neste computador.'
            : 'O Argus usa o login do Claude Code, o mesmo do terminal e do VS Code. Entre com sua assinatura do Claude ou pague pelo uso da API.'}
        </p>
        {install ? (
          <InstallPanel claude={claude} />
        ) : (
          <LoginPanel login={login} onStart={(method) => window.api.auth.login(MAIN_ACCOUNT, method)} />
        )}
      </div>
    </div>
  )
}
