import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { tr } from './i18n'
import { Presence } from './motion'
import { IS_REMOTE, REMOTE_HOST } from './remote'

// Janela de acesso remoto: o que não funciona de longe explica o porquê, num aviso no pé da janela
// que some sozinho, em vez de o clique não fazer nada. Vem de dois lugares: o processo principal
// (pedido bloqueado, ver remote/policy.ts) e a própria tela (arquivo arrastado, localhost).

const HIDE_MS = 7000

const host = () => REMOTE_HOST?.name ?? tr('outro computador', 'the other computer')

// O texto de cada pedido bloqueado. Fora daqui, silêncio: o que o app pede sozinho, sem clique
// (mascote, player, ditado, que já tem o aviso dele), não vira aviso.
function blockedMessage(channel: string): string | null {
  const h = host()
  switch (channel) {
    case 'files:view':
      return tr(
        `Esse arquivo abre no visualizador do sistema, que ficaria na tela de ${h}. Pelo acesso remoto, só arquivos de texto e código abrem aqui, no painel.`,
        `This file opens in the system viewer, which would show on ${h}'s screen. Over remote access, only text and code files open here, in the panel.`
      )
    case 'files:reveal':
    case 'files:openFolder':
      return tr(`A pasta abriria no gerenciador de arquivos de ${h}, não aqui.`, `The folder would open in ${h}'s file manager, not here.`)
    case 'files:openInBrowser':
      return tr(`Esse arquivo abriria no navegador de ${h}, não aqui.`, `This file would open in ${h}'s browser, not here.`)
    case 'dialog:pickFolder':
    case 'dialog:pickFolders':
      return tr(
        `O seletor de pastas abriria na tela de ${h}. Pelo acesso remoto, digite o caminho completo da pasta.`,
        `The folder picker would open on ${h}'s screen. Over remote access, type the folder's full path.`
      )
    case 'popout:open':
      return tr(`A janela separada abriria na tela de ${h}. Pelo acesso remoto, a conversa fica aqui no painel.`, `The separate window would open on ${h}'s screen. Over remote access, the chat stays here in the panel.`)
    case 'canvas:newWindow':
      return tr(`Uma janela nova do canvas abriria em ${h}, não aqui.`, `A new canvas window would open on ${h}, not here.`)
    case 'files:copy':
    case 'files:paste':
      return tr(
        `Copiar e colar arquivos usa a área de transferência de ${h}. Pelo acesso remoto ainda não dá.`,
        `Copying and pasting files uses ${h}'s clipboard. Not possible over remote access yet.`
      )
    case 'auth:login':
    case 'auth:add':
    case 'auth:install':
    case 'auth:code':
    case 'providers:add':
    case 'providers:login':
    case 'providers:install':
    case 'providers:submitKey':
      return tr(`Entrar numa conta abre o navegador de ${h}. Faça isso direto em ${h}.`, `Signing in opens ${h}'s browser. Do it directly on ${h}.`)
    case 'updates:install':
      return tr(`Atualizar reinicia o Argus de ${h}. Faça a atualização por lá.`, `Updating restarts Argus on ${h}. Update it there.`)
    default:
      return null
  }
}

type Listener = (text: string) => void
const listeners = new Set<Listener>()

// Mostra um aviso na janela remota (fora dela, nada).
export function showRemoteNotice(text: string): void {
  if (!IS_REMOTE) return
  for (const l of listeners) l(text)
}

// Servidor do projeto rodando no outro computador: abre no navegador daqui por um túnel na ligação
// (ver main/remote/tunnelClient.ts). Com a porta ocupada aqui, vai por outra, e o aviso diz qual.
export function openRemoteLocalhost(port: number): void {
  void window.api.remote.openLocalhost(port).then((r) => {
    if (!r.ok) return showRemoteNotice(r.error)
    if (r.port !== port)
      showRemoteNotice(
        tr(
          `A porta ${port} já está em uso neste computador: o servidor de ${host()} abriu em localhost:${r.port}.`,
          `Port ${port} is already in use on this computer: ${host()}'s server opened at localhost:${r.port}.`
        )
      )
  })
}

// Anexos (fora imagens e áudios) grandes demais para mandar ao outro computador.
export function bigFilesNotice(count: number, max: number): void {
  const h = host()
  const mb = Math.round(max / 1024 / 1024)
  showRemoteNotice(
    count === 1
      ? tr(
          `Esse arquivo passa de ${mb} MB e não vai para ${h} pelo acesso remoto.`,
          `This file is over ${mb} MB and can’t be sent to ${h} over remote access.`
        )
      : tr(
          `Esses ${count} arquivos passam de ${mb} MB e não vão para ${h} pelo acesso remoto.`,
          `These ${count} files are over ${mb} MB and can’t be sent to ${h} over remote access.`
        )
  )
}

export function RemoteNotice() {
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null)

  useEffect(() => {
    if (!IS_REMOTE) return
    let id = 0
    const show: Listener = (text) => setNotice((current) => (current?.text === text ? current : { text, id: ++id }))
    listeners.add(show)
    const off = window.api.remote.onBlocked((channel) => {
      const text = blockedMessage(channel)
      if (text) show(text)
    })
    return () => {
      listeners.delete(show)
      off()
    }
  }, [])

  // Cada aviso novo conta o tempo de novo.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), HIDE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  if (!IS_REMOTE) return null
  // No body e acima dos modais (z-50): o aviso de um login nas Configurações aparece por cima delas.
  return createPortal(
    <Presence kind="menu">
      {notice && (
        <div
          role="status"
          className="fixed bottom-14 left-1/2 z-[70] flex w-max max-w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2.5 rounded-lg border border-line bg-surface-2 py-2.5 pr-2 pl-3.5 text-[14px] leading-relaxed text-text shadow-lg shadow-black/30"
        >
          <Info size={16} className="mt-0.5 shrink-0 text-remote" />
          <span className="min-w-0 flex-1">{notice.text}</span>
          <button
            type="button"
            aria-label={tr('Fechar aviso', 'Close notice')}
            onClick={() => setNotice(null)}
            className="shrink-0 rounded-md p-1 text-muted hover:bg-fill hover:text-text"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </Presence>,
    document.body
  )
}
