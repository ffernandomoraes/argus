import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, screen, shell } from 'electron'
import type { AgentDraftRequest, AgentSaveRequest } from '../shared/agents'
import type { CanvasToolResult } from '../shared/canvasAgent'
import type { ChatRemoteRequest, ChatSendRequest, ChatSettings, PermissionAnswer } from '../shared/chat'
import type { TerminalOpenRequest } from '../shared/terminal'
import type { LoginMethod } from '../shared/auth'
import { listAgents, removeAgent, saveAgent } from './agents'
import { loadAppSettings, saveAppSettings } from './appSettings'
import { Auth } from './auth'
import { draftAgent } from './agentWriter'
import { CanvasAgent } from './canvasAgent'
import { Cli, cliStatus, installCli, uninstallCli } from './cli'
import { Chats } from './chats'
import { ChatNotifier } from './notifications'
import { loadCanvas, saveCanvas } from './canvasStore'
import { killDevServer, listDevServers } from './devServers'
import { projectServers, startProjectServer, stopProjectServer, stopStartedServers } from './projectServers'
import { listDir, readFile } from './files'
import { unwatchFile, watchFile } from './fileWatch'
import { Popouts } from './popouts'
import { readHistory, readImages } from './history'
import { listMemory, readMemory, writeMemory } from './memory'
import type { MemoryProject } from '../shared/memory'
import { SessionWatch } from './sessionWatch'
import { listKnownFolders, listSessions } from './sessions'
import { currentBranch, fileDiff, uncommittedFiles } from './gitBranch'
import { Speech } from './speech'
import { StatusTray } from './statusTray'
import { Terminals } from './terminals'
import { UsageMonitor } from './usageMonitor'
import { Updater } from './updater'

// O pnpm dev tem dados próprios: com a mesma pasta do instalado, um sobrescreveria o canvas e as
// configurações do outro.
if (!app.isPackaged) app.setPath('userData', `${app.getPath('userData')} Dev`)

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

const terminals = new Terminals(
  (key, data) => broadcast('terminal:data', key, data),
  (key, code) => broadcast('terminal:exit', key, code)
)

const sessionWatch = new SessionWatch((path) => broadcast('sessions:changed', path))

// Criado com o app pronto (o Tray exige). Nulo também quando desligado nas configurações.
let tray: StatusTray | null = null

function setMenuBarIcon(on: boolean): void {
  if (on && !tray) tray = new StatusTray(() => chats.list(), showApp)
  if (!on && tray) {
    tray.destroy()
    tray = null
  }
}

const chats = new Chats((key, state) => {
  broadcast('chat:state', key, state)
  tray?.refresh()
  notifier.refresh()
})

// Clique na notificação: traz o app e abre a conversa que avisou.
const notifier = new ChatNotifier(
  () => chats.list(),
  (cwd, sessionId) => {
    showApp()
    if (sessionId && canvasReady) mainWindow?.webContents.send('chat:open', cwd, sessionId)
  }
)

const usage = new UsageMonitor(
  (data) => broadcast('usage:update', data),
  (info) => broadcast('claude:info', info)
)

// Login do Claude Code. Trocou de conta: o monitor de uso e as conversas paradas abrem de novo
// com o login novo; as que estão trabalhando terminam o pedido e fecham em seguida.
const auth = new Auth(
  (state) => broadcast('auth:state', state),
  () => {
    usage.reconnect()
    chats.releaseAll()
  }
)

function loadRenderer(win: BrowserWindow, hash = ''): void {
  // Só o pnpm dev carrega do Vite; o instalado ignora a variável mesmo se ela vier herdada.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (hash ? `#${hash}` : ''))
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}

const webPreferences = { preload: join(__dirname, '../preload/index.js'), sandbox: false }

// Links das conversas abrem no navegador do sistema, não numa janela do app.
function openLinksOutside(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
}

let mainWindow: BrowserWindow | null = null

// Assistente do canvas: as ações vão para a janela principal, que é onde o canvas vive.
const canvasAgent = new CanvasAgent(
  () => mainWindow?.webContents ?? null,
  (state) => broadcast('canvasAgent:state', state)
)

function createWindow(): void {
  // Abre ocupando a tela toda (sem cobrir menu e dock).
  const { workArea } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#161618',
    webPreferences
  })
  win.maximize()
  openLinksOutside(win)
  loadRenderer(win)
  mainWindow = win
  // Recarregar a página derruba quem escuta o `argus`; ele avisa de novo quando o canvas montar.
  win.webContents.on('did-start-loading', () => mainWindow === win && (canvasReady = false))
  win.on('closed', () => {
    if (mainWindow !== win) return
    mainWindow = null
    canvasReady = false
  })
}

// Traz o canvas para frente (ou abre de novo, se a janela foi fechada).
function showApp(): void {
  if (!mainWindow) return createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  app.focus({ steal: true })
}

// Janela de uma conversa só, para levar a outro monitor.
function createConversationWindow(hash: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 860,
    minWidth: 420,
    minHeight: 480,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#161618',
    webPreferences
  })
  openLinksOutside(win)
  loadRenderer(win, hash)
  return win
}

const speech = new Speech()

// Versão nova baixada em segundo plano: entra com o botão da barra de título ou ao fechar o app.
const updater = new Updater((state) => broadcast('updates:state', state))

// "Procurar atualizações…" do menu: diferente da conferência automática, sempre responde.
async function checkForUpdates(): Promise<void> {
  const state = await updater.check()
  const current = app.getVersion()
  if (state.status === 'ready') {
    const { response } = await dialog.showMessageBox({
      message: `A versão ${state.version} está pronta.`,
      detail: `Você está na ${current}. O Argus reinicia para atualizar.`,
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 0) updater.install(true)
    return
  }
  const message =
    state.status === 'latest' ? 'Você já está na versão mais recente.'
    : state.status === 'downloading' ? `Baixando a versão ${state.version}.`
    : state.status === 'unsupported' ? state.reason
    : state.status === 'error' ? 'Não deu para procurar atualizações.'
    : 'Procurando atualizações.'
  await dialog.showMessageBox({
    message,
    detail: state.status === 'error' ? state.message : `Versão em uso: ${current}.`
  })
}

// `argus .` num terminal: traz o app para frente e manda a pasta para o canvas. Com o app
// ainda abrindo, a pasta espera o canvas avisar que está pronto.
let canvasReady = false
const pendingOpens: string[] = []
const cli = new Cli((path) => {
  showApp()
  if (canvasReady && mainWindow) mainWindow.webContents.send('cli:open', path)
  else pendingOpens.push(path)
})

// Janela de conversa fechada: a sessão dela não fica rodando atrás (a limpeza do React
// não chega a rodar quando a janela é destruída).
const popouts = new Popouts(createConversationWindow, (id) => {
  chats.release(id)
  broadcast('popout:closed', id)
})

// Menu sem os itens de zoom padrão: ⌘+ / ⌘- / ⌘0 ficam para o canvas.
// O menu Editar é mantido porque copiar e colar (prints no chat) dependem dele.
function sendEdit(win: Electron.BaseWindow | undefined, action: 'undo' | 'redo'): void {
  if (win instanceof BrowserWindow) win.webContents.send('edit', action)
}

function setAppMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { label: 'Procurar atualizações…', click: () => void checkForUpdates() },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Editar',
        submenu: [
          // Desfazer/refazer vão para a interface decidir: texto em edição ou canvas.
          { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', click: (_i, win) => sendEdit(win, 'undo') },
          { label: 'Refazer', accelerator: 'Shift+CmdOrCtrl+Z', click: (_i, win) => sendEdit(win, 'redo') },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'Ver',
        submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }]
      },
      { role: 'windowMenu' }
    ])
  )
}

app.whenReady().then(() => {
  setAppMenu()
  ipcMain.handle('usage:get', () => usage.last)
  ipcMain.handle('claude:info', () => usage.info)
  ipcMain.handle('auth:state', () => auth.state)
  ipcMain.on('auth:login', (_e, method: LoginMethod) => void auth.login(method))
  ipcMain.on('auth:code', (_e, code: string) => auth.submitCode(code))
  ipcMain.on('auth:cancel', () => auth.cancel())
  ipcMain.handle('auth:logout', () => auth.logout())
  ipcMain.on('auth:open', (_e, url: string) => /^https:/.test(url) && void shell.openExternal(url))
  ipcMain.on('speech:start', (e) => speech.start(e.sender))
  ipcMain.on('speech:stop', () => speech.stop())
  // Abre Ajustes do Sistema > Teclado, onde fica o Ditado.
  ipcMain.on('speech:openSettings', () => shell.openExternal('x-apple.systempreferences:com.apple.Keyboard-Settings.extension'))
  ipcMain.on('popout:open', (_e, id: string, payload: unknown) => popouts.show(id, payload))
  ipcMain.handle('popout:payload', (_e, id: string) => popouts.payload(id))
  // Mudança de modelo/esforço/modo numa janela vai para as outras.
  ipcMain.on('conversation:settings', (e, id: string, settings: unknown) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents !== e.sender) win.webContents.send('conversation:settings', id, settings)
    }
  })
  ipcMain.on('theme:set', (_e, theme: 'dark' | 'light' | 'system') => {
    nativeTheme.themeSource = theme
  })
  ipcMain.on('canvas:load', (e) => {
    e.returnValue = loadCanvas()
  })
  ipcMain.handle('canvas:save', (_e, data: unknown) => saveCanvas(data))
  ipcMain.handle('canvasAgent:state', () => canvasAgent.state)
  ipcMain.on('canvasAgent:send', (_e, text: string) => canvasAgent.send(text))
  ipcMain.on('canvasAgent:interrupt', () => void canvasAgent.interrupt())
  ipcMain.on('canvasAgent:result', (_e, result: CanvasToolResult) => canvasAgent.result(result))
  ipcMain.handle('memory:list', (_e, projects: MemoryProject[]) => listMemory(projects))
  ipcMain.handle('memory:read', (_e, path: string, projects: MemoryProject[]) => readMemory(path, projects))
  ipcMain.handle('memory:write', (_e, path: string, text: string, projects: MemoryProject[]) =>
    writeMemory(path, text, projects)
  )
  ipcMain.handle('agents:list', (_e, projectPath?: string) => listAgents(projectPath))
  ipcMain.handle('agents:save', (_e, req: AgentSaveRequest) => saveAgent(req))
  ipcMain.handle('agents:remove', (_e, name: string) => removeAgent(name))
  ipcMain.handle('agents:draft', (_e, req: AgentDraftRequest) => draftAgent(req))
  ipcMain.handle('sessions:list', (_e, path: string) => listSessions(path))
  ipcMain.handle('sessions:folders', () => listKnownFolders())
  ipcMain.handle('sessions:branch', (_e, path: string) => currentBranch(path))
  ipcMain.handle('sessions:changes', (_e, path: string) => uncommittedFiles(path))
  ipcMain.on('sessions:watch', (_e, paths: string[]) => sessionWatch.setProjects(paths))
  ipcMain.handle('sessions:history', (_e, path: string, id: string) => readHistory(path, id))
  ipcMain.handle('sessions:images', (_e, path: string, id: string, messageId: string) => readImages(path, id, messageId))
  ipcMain.handle('devServers:list', () => listDevServers())
  ipcMain.handle('devServers:kill', (_e, pgid: number) => killDevServer(pgid))
  ipcMain.handle('projectServers:status', (_e, paths: string[]) => projectServers(paths))
  ipcMain.handle('projectServers:start', (_e, path: string) => startProjectServer(path))
  ipcMain.handle('projectServers:stop', (_e, path: string) => stopProjectServer(path))
  ipcMain.handle('files:list', (_e, root: string, rel: string) => listDir(root, rel))
  ipcMain.handle('files:read', (_e, root: string, rel: string) => readFile(root, rel))
  ipcMain.handle('files:diff', (_e, root: string, rel: string) => fileDiff(root, rel))
  ipcMain.on('files:watch', (e, root: string, rel: string) => watchFile(e.sender, root, rel))
  ipcMain.on('files:unwatch', (e) => unwatchFile(e.sender))
  // Chat e terminal não ficam abertos juntos na mesma conversa: os dois gravariam na mesma
  // sessão. Abrir um encerra o outro; o histórico continua no arquivo da sessão.
  ipcMain.handle('chat:state', (_e, key: string) => chats.state(key))
  ipcMain.on('chat:send', (_e, req: ChatSendRequest) => {
    terminals.kill(req.key)
    if (req.sessionId) terminals.kill(req.sessionId)
    chats.send(req)
  })
  ipcMain.on('chat:remote-control', (_e, req: ChatRemoteRequest) => {
    terminals.kill(req.key)
    if (req.sessionId) terminals.kill(req.sessionId)
    chats.remoteControl(req)
  })
  ipcMain.on('chat:answer', (_e, key: string, id: string, answer: PermissionAnswer) => chats.answer(key, id, answer))
  ipcMain.handle('mcp:status', (_e, key: string, cwd: string) => chats.mcpStatus(key, cwd))
  ipcMain.on('chat:retain', (_e, key: string) => chats.retain(key))
  ipcMain.on('chat:release', (_e, key: string) => chats.release(key))
  ipcMain.on('chat:interrupt', (_e, key: string) => chats.interrupt(key))
  ipcMain.on('chat:configure', (_e, key: string, patch: Partial<ChatSettings>) => chats.configure(key, patch))
  ipcMain.handle('terminal:open', (_e, req: TerminalOpenRequest) => {
    chats.close(req.key)
    if (req.sessionId) chats.close(req.sessionId)
    return terminals.open(req)
  })
  ipcMain.on('terminal:rename', (_e, oldKey: string, newKey: string) => terminals.rename(oldKey, newKey))
  ipcMain.on('terminal:write', (_e, key: string, data: string) => terminals.write(key, data))
  ipcMain.on('terminal:resize', (_e, key: string, cols: number, rows: number) => terminals.resize(key, cols, rows))
  ipcMain.on('terminal:kill', (_e, key: string) => terminals.kill(key))
  ipcMain.on('cli:ready', (e) => {
    if (e.sender !== mainWindow?.webContents) return
    canvasReady = true
    for (const path of pendingOpens.splice(0)) e.sender.send('cli:open', path)
  })
  ipcMain.handle('cli:status', () => cliStatus())
  ipcMain.handle('cli:install', () => installCli())
  ipcMain.handle('cli:uninstall', () => uninstallCli())
  ipcMain.handle('settings:get', () => loadAppSettings())
  ipcMain.handle('updates:get', () => ({ version: app.getVersion(), state: updater.state }))
  ipcMain.handle('updates:check', () => updater.check())
  ipcMain.on('updates:install', () => updater.install(true))
  ipcMain.handle('settings:menuBarIcon', (_e, on: boolean) => {
    setMenuBarIcon(on)
    return saveAppSettings({ menuBarIcon: on })
  })
  ipcMain.handle('dialog:pickFolder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Escolha a pasta do projeto',
      buttonLabel: 'Adicionar',
      defaultPath: app.getPath('desktop'),
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0]
  })
  usage.start()
  void auth.refresh()
  cli.start()
  updater.start()
  setMenuBarIcon(loadAppSettings().menuBarIcon)
  app.on('browser-window-focus', () => tray?.seen())
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Encerra tudo que o app abriu (claude, terminais, ditado, servidores de projeto) para não sobrar processo solto.
function shutdown(): void {
  usage.stop()
  auth.cancel()
  speech.stop()
  tray?.destroy()
  tray = null
  terminals.killAll()
  stopStartedServers()
  cli.stop()
  chats.closeAll()
  canvasAgent.close()
  sessionWatch.close()
  updater.stop()
  // Versão nova já baixada e o app fechando: troca agora, para abrir atualizado da próxima vez.
  updater.install(false)
}

app.on('before-quit', shutdown)

// O modo de desenvolvimento reinicia o app com SIGTERM a cada mudança no processo principal.
// Sem tratar o sinal, um app ainda abrindo podia ignorá-lo e ficar aberto ao lado do novo.
process.on('SIGTERM', () => {
  shutdown()
  app.exit(0)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') return app.quit()
  // No macOS o app segue no Dock; sem janela, nada precisa de sessão de chat aberta.
  chats.releaseAll()
})

// Ctrl+C no terminal que subiu o app também encerra tudo que ele abriu.
process.on('SIGINT', () => {
  shutdown()
  app.exit(0)
})
