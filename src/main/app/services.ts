import { join } from 'node:path'
import { app } from 'electron'
import { resolveAccount } from '../accounts'
import { Auth } from '../auth'
import { Providers } from '../providers'
import { onConversationSaved } from '../agentChats/store'
import { agentRef } from '../../shared/providers'
import { CanvasAgent } from '../canvasAgent'
import { Boards } from '../boards'
import { ChatHolders } from '../chatHolders'
import { ClaudeVersion } from '../claudeVersion'
import { Chats } from '../chats'
import { activeChats, activeSignature } from '../chats/entries'
import { Cli } from '../cli'
import { broadcast, sendTo } from '../ipc/events'
import { ChatNotifier } from '../notifications'
import { setClaudeInfo } from '../orchestration'
import { Popouts } from '../popouts'
import { SessionWatch } from '../sessionWatch'
import { onDiskFull } from '../lib/atomicWrite'
import { Speech } from '../speech'
import { StorageCleaner } from '../storage'
import { liveSessions } from '../liveSessions'
import { readDisk } from '../systemHealth/disk'
import { readMemory } from '../systemHealth/memory'
import { SystemHealth } from '../systemHealth'
import { Terminals } from '../terminals'
import { Updater } from '../updater'
import { UsageMonitors } from '../usageMonitor'
import { readyCanvas } from './canvasRegistry'
import { DockBadge } from './dockBadge'
import { InterruptedChats } from './interruptedChats'
import { KeepAwake } from './keepAwake'
import { openFolder } from './folderOpener'
import { MascotOverlay } from './mascotOverlay'
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
  const unread = new UnreadChats(() => {
    tray.refresh()
    badge.refresh()
    mascot.refresh()
  })
  // Memória e disco do computador e o que parou por falta deles: o aviso da barra de cima.
  const health = new SystemHealth({ memory: readMemory, disk: (previous) => readDisk(app.getPath('userData'), previous) }, (state) =>
    broadcast('health:state', state)
  )
  health.start()
  onDiskFull(() => health.record({ kind: 'diskFull' }))

  // Rascunhos do agente e prints das conversas antigas: limpos sozinhos (aba Armazenamento). Antes de
  // tudo que abre o `claude`: o histórico precisa estar guardado quando ele abrir.
  const storage = new StorageCleaner(async () => new Set((await liveSessions()).keys()))
  storage.start()

  // Conversas que o app fechou no meio: as janelas mostram interrompidas, e o ícone da barra lista.
  const interrupted = new InterruptedChats(join(app.getPath('userData'), 'interruptedChats.json'), () => {
    broadcast('chat:interrupted', interrupted.list())
    tray.refresh()
  })
  const tray = new MenuBarIcon({ chats: () => chats.list(), unread: () => unread.list(), interrupted: () => interrupted.list(), showApp, openChat })
  const badge = new DockBadge(() => chats.list(), () => unread.list())
  // Mascote solto na tela: check verde com resposta não vista, aviso vermelho com erro.
  const mascot = new MascotOverlay(() => unread.list(), () => chats.list())

  // O indicador do canto do canvas só recebe a lista quando ela muda de verdade.
  let activeShown = ''
  const publishActive = (): void => {
    const list = activeChats(chats.list())
    const signature = activeSignature(list)
    if (signature === activeShown) return
    activeShown = signature
    broadcast('chat:active', list)
  }

  const chats = new Chats(
    (key, state) => {
      broadcast('chat:state', key, state)
      // Antes do ícone da barra: a que voltou a trabalhar sai das interrompidas.
      interrupted.update(chats.list())
      // Trabalhando de novo: a fechada para liberar memória perde a linha que explica a demora. O
      // estado parado que a sessão manda ao fechar não conta.
      if (state.status !== 'idle') health.reopened(state.sessionId)
      tray.refresh()
      badge.refresh()
      notifier.refresh()
      // Antes da lista de ativas: a janela do mascote precisa saber do erro quando vê o pedido acabar.
      mascot.refresh()
      publishActive()
      keepAwake.refresh()
    },
    {
      freed: (cwd, sessionId) => health.record({ kind: 'chatClosed', cwd, sessionId }),
      // Sem memória no meio de uma resposta: a conversa fica interrompida, com o botão de continuar.
      limit: (cwd, sessionId, limit, busy) => {
        health.record(limit === 'disk' ? { kind: 'diskFull' } : { kind: 'claudeStopped', cwd, sessionId, busy })
        if (limit === 'memory' && busy && sessionId) interrupted.mark(sessionId, cwd, 'memory')
      }
    }
  )

  // Com agente trabalhando, o computador não dorme por inatividade.
  const keepAwake = new KeepAwake({ chats: () => chats.list(), terminalsWorking: () => terminals.claudeWorking() })

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
  // Modelos de cada conta do Claude, para o orquestrador listar (ver orchestration/).
  setClaudeInfo((account) => usage.info(resolveAccount(account)))

  // Contas do Claude Code. O login de uma conta trocou: o monitor de uso e as conversas paradas
  // dela abrem de novo com o login novo; as que estão trabalhando terminam o pedido e fecham em
  // seguida. Conta removida: tudo que roda com ela fecha na hora.
  const auth = new Auth(
    (state) => {
      broadcast('auth:state', state)
      usage.sync(state.accounts)
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

  // Contas dos outros agentes (Codex, Gemini, Cursor; ver src/main/providers/). Login trocado: as
  // conversas paradas da conta abrem de novo com o novo. Conta removida: fecham na hora.
  // Limites: só o Codex informa (Gemini e Cursor não têm leitura por programa); um monitor por conta
  // logada, que some com ela.
  const providers = new Providers(
    (state) => {
      broadcast('providers:state', state)
      usage.codex.sync(state.providers.codex.accounts)
    },
    (provider, id) => {
      chats.releaseAll(agentRef(provider, id))
      if (provider === 'codex') usage.codex.reread(id)
    },
    (provider, id) => {
      chats.closeAccount(agentRef(provider, id))
      terminals.killAccount(agentRef(provider, id))
    }
  )
  onConversationSaved((cwd) => sessionWatch.conversationChanged(cwd))

  // Os workspaces (um canvas cada): a mudança numa janela vai para as outras que mostram o mesmo.
  const boards = new Boards(
    (wc, board, nodes) => sendTo(wc, 'canvas:remote', board, nodes),
    (list) => broadcast('boards:changed', list)
  )

  // Assistente do canvas: as ações vão para a janela do canvas em uso, só com o canvas dela montado
  // (numa janela ainda carregando, a ação ficaria esperando resposta até o tempo esgotar).
  const canvasAgent = new CanvasAgent(
    () => readyCanvas()?.webContents ?? null,
    (state) => broadcast('canvasAgent:state', state)
  )

  const speech = new Speech()

  // Versão nova baixada em segundo plano: entra com o botão da barra de título ou, fora do Windows,
  // ao fechar o app (ver shutdown.ts).
  const updater = new Updater((state) => broadcast('updates:state', state))

  const cli = new Cli(openFolder)

  // Versão do Claude Code: usa o `claude` mais novo da máquina e avisa quando há versão nova. Trocado
  // ou atualizado, os monitores de uso abrem de novo e a lista de modelos vem do novo.
  const claudeVersion = new ClaudeVersion(
    (state) => broadcast('claudeVersion:state', state),
    () => {
      usage.reconnectAll()
      // Instalado agora pelo botão (não havia nenhum): a tela de instalação sai.
      void auth.refresh()
    }
  )

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
    interrupted,
    health,
    storage,
    chats,
    chatHolders,
    notifier,
    usage,
    auth,
    providers,
    boards,
    canvasAgent,
    speech,
    updater,
    claudeVersion,
    cli,
    popouts,
    unsavedFiles,
    mascot
  }
}
