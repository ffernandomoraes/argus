import { useEffect, useState } from 'react'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { KEY_PAGES, PROVIDER_NAMES, type ClipboardKey, type ProviderLogin } from '../../../../shared/providers'
import { Button } from '../../ui/Button'
import { tr } from '../../i18n'

type Active = Exclude<ProviderLogin, { status: 'idle' }>

// Onde cada chave é criada, para o passo a passo.
const KEY_PLACE = {
  gemini: 'Google AI Studio',
  cursor: tr('painel do Cursor (Integrations > API Keys)', 'Cursor dashboard (Integrations > API Keys)')
} as const

// O login em andamento de um agente: navegador (Codex, a principal do Cursor) ou chave (Gemini, as
// outras do Cursor). Na chave, o app procura a chave copiada sozinho: a pessoa cria, copia, volta
// e confirma, sem colar nada.
export function ProviderLoginPanel({ login }: { login: Active }) {
  const name = PROVIDER_NAMES[login.provider]
  if (login.status === 'waiting') {
    return (
      <Panel>
        <div className="flex items-center gap-2 text-sm text-text">
          <Loader2 size={14} className="animate-spin text-muted" />
          {tr(`Termine o login do ${name} no navegador.`, `Finish signing in to ${name} in your browser.`)}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          {login.url ? (
            <>
              {tr('Não abriu?', 'Didn’t open?')}{' '}
              <button onClick={() => window.api.auth.open(login.url!)} className="text-muted underline hover:text-text">
                {tr('Abrir de novo', 'Open again')}
              </button>
            </>
          ) : (
            tr('Abrindo o navegador…', 'Opening the browser…')
          )}
        </p>
        <Actions />
      </Panel>
    )
  }
  return <KeyStep login={login} />
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-xl bg-fill p-4">{children}</div>
}

function Actions({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2">
      {children}
      <Button onClick={() => window.api.providers.cancel()}>{tr('Cancelar', 'Cancel')}</Button>
    </div>
  )
}

// Chave copiada: confere ao voltar para o app e, enquanto o passo está aberto, a cada instante
// (a pessoa pode copiar com a janela do app ao lado). Só o final da chave chega aqui.
function useClipboardKey(active: boolean): ClipboardKey {
  const [found, setFound] = useState<ClipboardKey>(null)
  useEffect(() => {
    if (!active) return
    let alive = true
    const look = () => void window.api.providers.clipboardKey().then((k) => alive && setFound(k))
    look()
    const timer = setInterval(look, 1500)
    window.addEventListener('focus', look)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('focus', look)
    }
  }, [active])
  return found
}

function KeyStep({ login }: { login: Exclude<Active, { status: 'waiting' }> }) {
  const provider = login.provider as 'gemini' | 'cursor'
  const name = PROVIDER_NAMES[provider]
  const checking = login.status === 'checking'
  const found = useClipboardKey(!checking)
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')

  if (checking) {
    return (
      <Panel>
        <div className="flex items-center gap-2 text-sm text-text">
          <Loader2 size={14} className="animate-spin text-muted" />
          {tr('Testando a chave…', 'Testing the key…')}
        </div>
      </Panel>
    )
  }

  return (
    <Panel>
      <p className="text-sm text-text">{tr(`Conectar com uma chave do ${name}`, `Connect with a ${name} key`)}</p>
      <ol className="flex list-decimal flex-col gap-1 pl-4 text-xs leading-relaxed text-muted">
        <li>
          {tr(`Abrimos o ${KEY_PLACE[provider]} no navegador. `, `We opened ${KEY_PLACE[provider]} in your browser. `)}
          <button onClick={() => window.api.auth.open(KEY_PAGES[provider])} className="underline hover:text-text">
            {tr('Abrir de novo', 'Open again')}
          </button>
        </li>
        <li>{tr('Crie uma chave e copie.', 'Create a key and copy it.')}</li>
        <li>{tr('Volte aqui: o Argus reconhece a chave copiada.', 'Come back here: Argus recognizes the copied key.')}</li>
      </ol>

      {login.status === 'error' && (
        <p role="alert" className="text-xs text-red-400">
          {login.message}
        </p>
      )}

      {found ? (
        <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
          <ClipboardCheck size={15} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 text-xs text-text">
            {tr(`Encontrei uma chave do ${name} copiada (${found.hint}).`, `Found a copied ${name} key (${found.hint}).`)}
          </span>
          <Button variant="primary" onClick={() => window.api.providers.submitKey()}>
            {tr('Usar esta chave', 'Use this key')}
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-xs text-faint">
          <Loader2 size={12} className="animate-spin" />
          {tr('Esperando você copiar a chave…', 'Waiting for you to copy the key…')}
        </p>
      )}

      {typing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim()) window.api.providers.submitKey(typed.trim())
          }}
        >
          <input
            autoFocus
            type="password"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={tr('Cole a chave aqui', 'Paste the key here')}
            aria-label={tr('Chave de API', 'API key')}
            className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1 text-sm text-text outline-none focus:border-accent"
          />
          <Button type="submit" disabled={!typed.trim()}>
            {tr('Usar', 'Use')}
          </Button>
        </form>
      ) : (
        <button onClick={() => setTyping(true)} className="self-start text-xs text-faint underline hover:text-text">
          {tr('Prefiro colar a chave', 'I’d rather paste the key')}
        </button>
      )}

      <p className="text-[11px] leading-relaxed text-faint">
        {tr(
          'A chave fica guardada no cofre do sistema e não aparece de novo na tela.',
          'The key is stored in the system keychain and never shown again.'
        )}
      </p>
      <Actions />
    </Panel>
  )
}
