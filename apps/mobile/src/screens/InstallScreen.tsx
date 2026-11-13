import { useEffect, useState } from 'react'
import { Download, PlusSquare, Share } from 'lucide-react'
import { tr } from '../i18n'
import { isIos } from '../lib/push'

// Aberto no navegador, o Argus não roda: só esta tela, pedindo para instalar. Como app (Tela de
// Início) ele abre em tela cheia, guarda o pareamento à parte do navegador e recebe notificações.
// No Android e no Chrome, o botão Instalar pede direto ao navegador; no iPhone isso não existe, e
// a tela mostra o caminho pelo Compartilhar. O código do QR code fica à vista para digitar no app.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// O navegador avisa cedo, antes de a tela montar: guardado aqui (ver main.tsx).
let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPrompt
    listeners.forEach((cb) => cb())
  })
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-0">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-white">{n}</span>
      <span className="pt-0.5 text-[17px] leading-snug">{children}</span>
    </li>
  )
}

export function InstallScreen({ code }: { code?: string }) {
  const [canPrompt, setCanPrompt] = useState(!!deferred)
  useEffect(() => {
    const cb = () => setCanPrompt(!!deferred)
    listeners.add(cb)
    return () => void listeners.delete(cb)
  }, [])
  const ios = isIos()

  const install = async () => {
    const p = deferred
    if (!p) return
    await p.prompt()
    await p.userChoice.catch(() => null)
    deferred = null
    setCanPrompt(false)
  }

  return (
    <div className="pt-safe px-safe pb-end flex min-h-full flex-col">
      <div className="flex flex-col items-center pt-14 pb-6 text-center">
        <img src="/icons/icon-192.png" alt="" className="size-20 rounded-[18px]" />
        <h1 className="mt-4 text-[22px] font-bold">{tr('Instale o Argus', 'Install Argus')}</h1>
        <p className="mt-2 max-w-[320px] text-[17px] leading-snug text-muted">
          {tr('O Argus roda como app, em tela cheia e com notificações. Não funciona no navegador.', 'Argus runs as an app, full screen and with notifications. It does not work in the browser.')}
        </p>
      </div>

      {canPrompt ? (
        <button type="button" onClick={() => void install()} className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-accent py-3.5 text-[17px] font-semibold text-white active:opacity-80">
          <Download size={20} />
          {tr('Instalar', 'Install')}
        </button>
      ) : (
        <ol className="overflow-hidden rounded-[12px] border border-card-border bg-card">
          {ios ? (
            <>
              <Step n={1}>
                {tr('Toque em Compartilhar', 'Tap Share')} <Share size={18} className="inline -translate-y-0.5 text-accent" />{' '}
                {tr('na barra do Safari.', 'in the Safari bar.')}
              </Step>
              <Step n={2}>
                {tr('Escolha "Adicionar à Tela de Início"', 'Choose "Add to Home Screen"')} <PlusSquare size={18} className="inline -translate-y-0.5 text-muted" />
              </Step>
              <Step n={3}>{tr('Abra o Argus pelo ícone na Tela de Início.', 'Open Argus from its Home Screen icon.')}</Step>
            </>
          ) : (
            <>
              <Step n={1}>{tr('Abra o menu do navegador.', 'Open the browser menu.')}</Step>
              <Step n={2}>{tr('Escolha "Instalar app" ou "Adicionar à tela inicial".', 'Choose "Install app" or "Add to home screen".')}</Step>
              <Step n={3}>{tr('Abra o Argus pelo ícone instalado.', 'Open Argus from the installed icon.')}</Step>
            </>
          )}
        </ol>
      )}

      {code && (
        <div className="mt-6 rounded-[12px] border border-card-border bg-card px-4 py-4 text-center">
          <p className="text-[15px] text-muted">{tr('Depois, no app, digite o código de pareamento:', 'Then, in the app, type the pairing code:')}</p>
          <p className="mt-1 font-mono text-[26px] font-semibold tracking-wider select-all">{code}</p>
          <p className="mt-1 text-[13px] text-faint">{tr('Vale por 10 minutos.', 'Valid for 10 minutes.')}</p>
        </div>
      )}
    </div>
  )
}
