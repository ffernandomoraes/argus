import { Auth } from '../auth'
import { CanvasAgent } from '../canvasAgent'
import { CanvasHub } from '../canvasHub'
import { ChatHolders } from '../chatHolders'
import { Chats } from '../chats'
import { activeChats, activeSignature } from '../chats/entries'
import { Cli } from '../cli'
import { broadcast, sendTo } from '../ipc/events'
import { ChatNotifier } from '../notifications'
import { Popouts } from '../popouts'
import { SessionWatch } from '../sessionWatch'
import { Speech } from '../speech'
import { Terminals } from '../terminals'
import { Updater } from '../updater'
import { UsageMonitors } from '../usageMonitor'
import { canvasWindowList, readyCanvas } from './canvasRegistry'
import { openFolder } from './folderOpener'
import { MenuBarIcon } from './menuBarIcon'
import { TerminalViewers } from './terminalViewers'
import { UnreadChats } from './unreadChats'
import { UnsavedFiles } from './unsavedFiles'
import { createConversationWindow, showApp } from './windows'

// Os serviços do processo principal e como um avisa o outro. Criados uma vez, na abertura.
export type Services = ReturnType<typeof createServices>

export function createServices() {
  // A saída de cada terminal vai só para as janelas que o abriram.
  const terminalViewers = new TerminalViewers()
  // A conversa que o `claude` de um terminal criou vai para todas as janelas: quem mostra o bloco
  // amarra (a janela que só vai abri-lo depois pergunta com terminal:session).
  const terminals = new Terminals(
    (key, data) => terminalViewers.data(key, data),
    (key, code) => terminalViewers.exit(key, code),
    (key, sessionId) => broadcast('terminal:session', key, sessionId)
  )

  const sessionWatch = new SessionWatch((path, change) => broadcast('sessions:changed', path, change))

  // Traz o app e abre a conversa (clique na notificação ou numa linha do ícone da barra).
  const openChat = (cwd: string, sessionId?: string): void => {
    showApp()
    const win = readyCanvas()
    if (sessionId && win) sendTo(win.webContents, 'chat:open', cwd, sessionId)
  }

  // Respostas que você ainda não viu, como as janelas contam: o ícone da barra mostra quantas.
  const unread = new UnreadChats(() => tray.refresh())
  const tray = new MenuBarIcon({ chats: () => chats.list(), unread: () => unread.list(), showApp, openChat })

  // O indicador do canto do canvas só recebe a lista quando ela muda de verdade.
  let activeShown = ''
  const publishActive = (): void => {
    const list = activeChats(chats.list())
    const signature = activeSignature(list)
    if (signature === activeShown) return
    activeShown = signature
    broadcast('chat:active', list)
  }

  const chats = new Chats((key, state) => {
    broadcast('chat:state', key, state)
    tray.refresh()
    notifier.refresh()
    publishActive()
  })

  const chatHolders = new ChatHolders(
    (key) => chats.retain(key),
    (key) => chats.release(key)
  )

  // Clique na notificação: traz o app e abre a conversa que avisou.
  const notifier = new ChatNotifier(() => chats.list(), openChat)

  // Limites de cada conta logada.
  const usage = new UsageMonitors(
    (account, data) => broadcast('usage:update', account, data),
    (account, info) => broadcast('claude:info', account, info)
  )

  // Contas do Claude Code. O login de uma conta trocou: o monitor de uso e as conversas paradas
  // dela abrem de novo com o login novo; as que estão trabalhando terminam o pedido e fecham em
  // seguida. Conta removida: tudo que roda com ela fecha na hora.
  const auth = new Auth(
    (state) => {
      broadcast('auth:state', state)
      usage.sync(state.accounts.filter((a) => a.status?.loggedIn).map((a) => a.id))
      sessionWatch.refreshStatusDirs()
    },
    (id) => {
      usage.reconnect(id)
      chats.releaseAll(id)
    },
    (id) => {
      usage.remove(id)
      chats.closeAccount(id)
      terminals.killAccount(id)
    }
  )

  // O canvas é um só em todas as janelas: a mudança de uma vai para as outras.
  const canvasHub = new CanvasHub((nodes, except) => {
    for (const win of canvasWindowList()) if (win.webContents !== except) sendTo(win.webContents, 'canvas:remote', nodes)
  })

  // Assistente do canvas: as ações vão para a janela do canvas em uso, só com o canvas dela montado
  // (numa janela ainda carregando, a ação ficaria esperando resposta até o tempo esgotar).
  const canvasAgent = new CanvasAgent(
    () => readyCanvas()?.webContents ?? null,
    (state) => broadcast('canvasAgent:state', state)
  )

  const speech = new Speech()

  // Versão nova baixada em segundo plano: entra com o botão da barra de título ou ao fechar o app.
  const updater = new Updater((state) => broadcast('updates:state', state))

  const cli = new Cli(openFolder)

  // Janela de conversa fechada: a sessão dela é solta pelo ChatHolders (a limpeza do React não chega
  // a rodar quando a janela é destruída).
  const popouts = new Popouts(createConversationWindow, (id) => broadcast('popout:closed', id))

  // Rascunhos do painel de código de cada janela, para a pergunta de fechar.
  const unsavedFiles = new UnsavedFiles()

  return {
    terminals,
    terminalViewers,
    sessionWatch,
    tray,
    unread,
    chats,
    chatHolders,
    notifier,
    usage,
    auth,
    canvasHub,
    canvasAgent,
    speech,
    updater,
    cli,
    popouts,
    unsavedFiles
  }
}
