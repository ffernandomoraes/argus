import { useState, type ReactNode } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import type { LoginMethod, LoginState } from '../../../shared/auth'

// Instruções da Anthropic para chave de API, Bedrock, Foundry e Vertex (o mesmo link da extensão do VS Code).
const THIRD_PARTY_URL = 'https://code.claude.com/docs/en/vs-code#use-third-party-providers'

function Option({
  title,
  note,
  primary,
  disabled,
  onClick
}: {
  title: ReactNode
  note: string
  primary?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div>
      <button
        disabled={disabled}
        onClick={onClick}
        className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm disabled:opacity-50 ${
          primary ? 'bg-text font-medium text-bg hover:opacity-90' : 'border border-line text-text hover:bg-surface-2'
        }`}
      >
        {title}
      </button>
      <p className="mt-1.5 text-center text-xs text-faint">{note}</p>
    </div>
  )
}

// Login como na extensão do VS Code: o navegador abre e volta sozinho para o app. Se não
// voltar, a pessoa entra por uma página que mostra um código e cola aqui.
function Waiting({ automaticUrl, manualUrl }: { automaticUrl: string; manualUrl: string }) {
  const [code, setCode] = useState('')
  const submit = () => code.trim() && window.api.auth.submitCode(code)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-text">
        <Loader2 size={14} className="animate-spin text-muted" />
        Termine o login no navegador.
      </div>
      <p className="text-xs leading-relaxed text-faint">
        Não abriu?{' '}
        <button onClick={() => window.api.auth.open(automaticUrl)} className="text-muted underline hover:text-text">
          Abrir de novo
        </button>
        . Não voltou para o app?{' '}
        <button onClick={() => window.api.auth.open(manualUrl)} className="text-muted underline hover:text-text">
          Entre por uma página que mostra um código
        </button>{' '}
        e cole aqui:
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Código de autorização"
          aria-label="Código de autorização"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none placeholder:font-sans placeholder:text-faint focus:border-line-strong"
        />
        <button
          disabled={!code.trim()}
          onClick={submit}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}

// Escolha da forma de entrar e acompanhamento do login. Usado na tela de boas-vindas e em Conta.
export function LoginPanel({ login, onCancel }: { login: LoginState; onCancel?: () => void }) {
  const start = (method: LoginMethod) => window.api.auth.login(method)
  const busy = login.status === 'starting' || login.status === 'waiting'
  const cancel = () => {
    if (login.status !== 'idle') window.api.auth.cancel()
    onCancel?.()
  }

  return (
    <div className="flex flex-col gap-4">
      {login.status === 'waiting' ? (
        <Waiting automaticUrl={login.automaticUrl} manualUrl={login.manualUrl} />
      ) : (
        <>
          <Option
            primary
            disabled={busy}
            onClick={() => start('claudeai')}
            title={
              login.status === 'starting' && login.method === 'claudeai' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Assinatura do Claude'
              )
            }
            note="Use seu plano Pro, Max, Team ou Enterprise."
          />
          <Option
            disabled={busy}
            onClick={() => start('console')}
            title={
              login.status === 'starting' && login.method === 'console' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Anthropic Console'
              )
            }
            note="Pague pelo uso da API com sua conta do Console."
          />
          <Option
            disabled={busy}
            onClick={() => window.api.auth.open(THIRD_PARTY_URL)}
            title={
              <>
                Bedrock, Foundry ou Vertex
                <ExternalLink size={12} className="text-faint" />
              </>
            }
            note="Instruções para usar chave de API ou outros provedores."
          />
        </>
      )}

      {login.status === 'error' && (
        <p role="alert" className="text-xs leading-relaxed text-red-400">
          Não deu para entrar: {login.message}
        </p>
      )}

      {(busy || onCancel) && (
        <button onClick={cancel} className="self-center rounded-md px-3 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text">
          Cancelar
        </button>
      )}
    </div>
  )
}
