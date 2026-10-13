import { useState, type ReactNode } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import type { LoginMethod, LoginState } from '../../../shared/auth'
import { tr } from '../i18n'

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
        className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm disabled:opacity-50 ${
          primary ? 'bg-accent font-medium text-white hover:brightness-110' : 'border border-line text-text hover:bg-surface-2'
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
        {tr('Termine o login no navegador.', 'Finish signing in in your browser.')}
      </div>
      <p className="text-xs leading-relaxed text-faint">
        {tr('Não abriu?', 'Didn’t open?')}{' '}
        <button onClick={() => window.api.auth.open(automaticUrl)} className="text-muted underline hover:text-text">
          {tr('Abrir de novo', 'Open again')}
        </button>
        {tr('. Não voltou para o app?', '. Didn’t return to the app?')}{' '}
        <button onClick={() => window.api.auth.open(manualUrl)} className="text-muted underline hover:text-text">
          {tr('Entre por uma página que mostra um código', 'Sign in on a page that shows a code')}
        </button>{' '}
        {tr('e cole aqui:', 'and paste it here:')}
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={tr('Código de autorização', 'Authorization code')}
          aria-label={tr('Código de autorização', 'Authorization code')}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none placeholder:font-sans placeholder:text-faint focus:border-line-strong"
        />
        <button
          disabled={!code.trim()}
          onClick={submit}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
        >
          {tr('Enviar', 'Submit')}
        </button>
      </div>
    </div>
  )
}

// Escolha da forma de entrar e acompanhamento do login. Usado na tela de boas-vindas e em Contas;
// onStart diz em qual conta entrar (ou se é uma nova).
export function LoginPanel({
  login,
  onStart,
  onCancel
}: {
  login: LoginState
  onStart: (method: LoginMethod) => void
  onCancel?: () => void
}) {
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
            onClick={() => onStart('claudeai')}
            title={
              login.status === 'starting' && login.method === 'claudeai' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                tr('Assinatura do Claude', 'Claude subscription')
              )
            }
            note={tr('Use seu plano Pro, Max, Team ou Enterprise.', 'Use your Pro, Max, Team or Enterprise plan.')}
          />
          <Option
            disabled={busy}
            onClick={() => onStart('console')}
            title={
              login.status === 'starting' && login.method === 'console' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Anthropic Console'
              )
            }
            note={tr('Pague pelo uso da API com sua conta do Console.', 'Pay for API usage with your Console account.')}
          />
          <Option
            disabled={busy}
            onClick={() => window.api.auth.open(THIRD_PARTY_URL)}
            title={
              <>
                {tr('Bedrock, Foundry ou Vertex', 'Bedrock, Foundry or Vertex')}
                <ExternalLink size={12} className="text-faint" />
              </>
            }
            note={tr('Instruções para usar chave de API ou outros provedores.', 'Instructions for using an API key or other providers.')}
          />
        </>
      )}

      {login.status === 'error' && (
        <p role="alert" className="text-xs leading-relaxed text-red-400">
          {tr('Não deu para entrar:', 'Could not sign in:')} {login.message}
        </p>
      )}

      {(busy || onCancel) && (
        <button onClick={cancel} className="self-center rounded-md px-3 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text">
          {tr('Cancelar', 'Cancel')}
        </button>
      )}
    </div>
  )
}
