import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, screen, shell, systemPreferences } from 'electron'
import type { AgentDraftRequest, AgentSaveRequest } from '../shared/agents'
import type { CanvasToolResult } from '../shared/canvasAgent'
import type { ChatRemoteRequest, ChatSendRequest, ChatSettings, PermissionAnswer } from '../shared/chat'
import type { TerminalOpenRequest } from '../shared/terminal'
import type { LoginMethod } from '../shared/auth'
import { cleanupAccounts, resolveAccount } from './accounts'
import { listAgents, removeAgent, saveAgent } from './agents'
import { loadAppSettings, saveAppSettings } from './appSettings'
import { Auth } from './auth'
import { draftAgent } from './agentWriter'
import { CanvasAgent } from './canvasAgent'
import { Cli, cliStatus, installCli, openArg, uninstallCli, validFolder } from './cli'
import { Chats } from './chats'
import { ChatNotifier } from './notifications'
import { loadCanvas, saveCanvas } from './canvasStore'
import { killDevServer, listDevServers } from './devServers'
import { projectServers, startProjectServer, stopProjectServer, stopStartedServers } from './projectServers'
import {
  copyToClipboard,
  createItem,
  listDir,
  pasteFromClipboard,
  readFile,
  renameItem,
  revealItem,
  trashItem,
  writeFile
} from './files'
import { unwatchFile, watchFile } from './fileWatch'
import { Popouts } from './popouts'
import { readHistory, readImages } from './history'
import { listMemory, readMemory, writeMemory } from './memory'
import type { MemoryProject } from '../shared/memory'
import { SessionWatch } from './sessionWatch'
import { listKnownFolders, listSessions, trashSession } from './sessions'
import { currentBranch, fileDiff, repoUrl, uncommittedFiles } from './gitBranch'
import { Speech } from './speech'
import { StatusTray } from './statusTray'
import { Terminals } from './terminals'
import { UsageMonitors } from './usageMonitor'
import { Updater } from './updater'
import { IS_MAC, IS_WIN } from './platform'
import { runSmokeTest, SMOKE_TEST } from './smokeTest'

// O pnpm dev tem dados próprios: com a mesma pasta do instalado, um sobrescreveria o canvas e as
// configurações do outro.
if (!app.isPackaged) app.setPath('userData', `${app.getPath('userData')} Dev`)

// No Windows cada clique no atalho abriria outro Argus com os mesmos dados: fica um só, e o
// segundo entrega ao primeiro a pasta do `argus .` (ver cli.ts) antes de sair. No Mac o próprio
// sistema não abre o app duas vezes.
const firstInstance = IS_MAC || app.requestSingleInstanceLock({ open: openArg(process.argv) })
if (!firstInstance) app.exit(0)

// Windows: identifica o app nas notificações, com o mesmo id do atalho que o instalador cria.
if (IS_WIN) app.setAppUserModelId(app.isPackaged ? 'dev.argus.app' : process.execPath)

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

function loadRenderer(win: BrowserWindow, hash = ''): void {
  // Só o pnpm dev carrega do Vite; o instalado ignora a variável mesmo se ela vier herdada.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (hash ? `#${hash}` : ''))
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}

const webPreferences = { preload: join(__dirname, '../preload/index.js'), sandbox: false }

// Altura da barra de título do app (TITLE_BAR_HEIGHT, em FloatingPanel.tsx).
const TITLE_BAR_HEIGHT = 40
type WindowKind = 'main' | 'conversation'
const windowKinds = new WeakMap<BrowserWindow, WindowKind>()

// Sem a barra do sistema. No Mac, os semáforos ficam dentro da barra do app. No Windows,
// minimizar, maximizar e fechar são desenhados pelo sistema por cima da barra do app, na cor dela:
// a barra de título do canvas (surface) ou o cabeçalho da conversa (bg), como no index.css.
function frame(kind: WindowKind): Electron.BrowserWindowConstructorOptions {
  if (IS_MAC) return { titleBarStyle: 'hiddenInset' }
  return { titleBarStyle: 'hidden', titleBarOverlay: overlay(kind) }
}

function overlay(kind: WindowKind): Electron.TitleBarOverlay {
  const dark = nativeTheme.shouldUseDarkColors
  const color = kind === 'main' ? (dark ? '#282828' : '#ffffff') : dark ? '#1c1c1c' : '#ececec'
  return { color, symbolColor: dark ? '#a5a5a5' : '#6e6e73', height: TITLE_BAR_HEIGHT }
}

// Vem como "rrggbbaa"; nulo onde o sistema não informa (aí fica o azul padrão do index.css).
function accentColor(): string | null {
  try {
    const c = systemPreferences.getAccentColor()
    return /^[0-9a-f]{6}/i.test(c) ? `#${c.slice(0, 6)}` : null
  } catch {
    return null
  }
}

// Tema trocado, no app ou no sistema: os botões do Windows acompanham.
function repaintOverlays(): void {
  if (IS_MAC) return
  for (const win of BrowserWindow.getAllWindows()) {
    const kind = windowKinds.get(win)
    if (kind && !win.isDestroyed()) win.setTitleBarOverlay(overlay(kind))
  }
}

// Windows: sem o menu Ver, o F12 (ou Ctrl+Shift+I) abre as ferramentas de desenvolvedor e o F11
// põe em tela cheia.
function windowShortcuts(win: BrowserWindow): void {
  if (IS_MAC) return
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      e.preventDefault()
      win.webContents.toggleDevTools()
    } else if (input.key === 'F11') {
      e.preventDefault()
      win.setFullScreen(!win.isFullScreen())
    }
  })
}

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
    ...frame('main'),
    backgroundColor: '#1c1c1c',
    webPreferences
  })
  windowKinds.set(win, 'main')
  win.maximize()
  openLinksOutside(win)
  windowShortcuts(win)
  loadRenderer(win)
  mainWindow = win
  // No Windows não há Dock para reabrir o canvas: fechar a janela fecha o app, passando pela mesma
  // pergunta de quando há algo rodando.
  if (!IS_MAC) {
    win.on('close', (e) => {
      if (quitting) return
      e.preventDefault()
      // Fora deste evento: cancelar o fechamento da janela também cancelaria um quit pedido aqui dentro.
      setImmediate(() => app.quit())
    })
  }
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
  // No Windows o foco não vem junto (o "steal" é só do Mac).
  if (!IS_MAC) mainWindow.focus()
  app.focus({ steal: true })
}

// Janela de uma conversa só, para levar a outro monitor.
function createConversationWindow(hash: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 860,
    minWidth: 420,
    minHeight: 480,
    ...frame('conversation'),
    backgroundColor: '#1c1c1c',
    webPreferences
  })
  windowKinds.set(win, 'conversation')
  openLinksOutside(win)
  windowShortcuts(win)
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
    if (response === 0) void restartToUpdate()
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
function openFolder(path: string): void {
  showApp()
  if (canvasReady && mainWindow) mainWindow.webContents.send('cli:open', path)
  else pendingOpens.push(path)
}
const cli = new Cli(openFolder)

// Windows: o argus.cmd abre o Argus.exe com a pasta. Com o app fechado, ela vem na abertura; com
// ele aberto, a segunda instância entrega a pasta a esta e sai.
const startFolder = !IS_MAC && validFolder(openArg(process.argv))
if (startFolder) pendingOpens.push(startFolder)
app.on('second-instance', (_e, argv, _cwd, data) => {
  const path = validFolder((data as { open?: string | null } | undefined)?.open ?? openArg(argv))
  if (path) openFolder(path)
  else showApp()
})

// Janela de conversa fechada: a sessão dela não fica rodando atrás (a limpeza do React
// não chega a rodar quando a janela é destruída).
const popouts = new Popouts(createConversationWindow, (id) => {
  chats.release(id)
  broadcast('popout:closed', id)
})

// Menu sem os itens de zoom padrão: ⌘+ / ⌘- / ⌘0 ficam para o canvas.
// O menu Editar é mantido porque copiar e colar (prints no chat) dependem dele.
// No Windows não há menu: a barra de título é a do app. Copiar e colar o navegador já faz sozinho,
// e Ctrl+Z / Ctrl+Shift+Z chegam à interface pelo preload, como os do menu Editar.
function sendEdit(win: Electron.BaseWindow | undefined, action: 'undo' | 'redo'): void {
  if (win instanceof BrowserWindow) win.webContents.send('edit', action)
}

function setAppMenu(): void {
  if (!IS_MAC) return Menu.setApplicationMenu(null)
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
  if (!firstInstance) return
  setAppMenu()
  ipcMain.handle('usage:get', () => usage.all())
  ipcMain.handle('claude:info', (_e, account?: string) => usage.info(resolveAccount(account)))
  ipcMain.handle('auth:state', () => auth.state)
  ipcMain.on('auth:refresh', () => void auth.refresh())
  ipcMain.on('auth:install', () => void auth.installClaude())
  ipcMain.on('auth:login', (_e, accountId: string, method: LoginMethod) => auth.login(accountId, method))
  ipcMain.on('auth:add', (_e, method: LoginMethod) => auth.add(method))
  ipcMain.on('auth:code', (_e, code: string) => auth.submitCode(code))
  ipcMain.on('auth:cancel', () => auth.cancel())
  ipcMain.handle('auth:logout', () => auth.logout())
  ipcMain.handle('auth:remove', (_e, accountId: string) => auth.remove(accountId))
  ipcMain.on('auth:rename', (_e, accountId: string, name: string) => auth.rename(accountId, name))
  ipcMain.on('auth:setDefault', (_e, accountId: string) => auth.setDefault(accountId))
  ipcMain.on('auth:open', (_e, url: string) => /^https:/.test(url) && void shell.openExternal(url))
  ipcMain.on('speech:start', (e) => speech.start(e.sender))
  ipcMain.on('speech:stop', () => speech.stop())
  // Windows: o áudio do microfone, gravado pela janela (ver preload/winMic.ts).
  ipcMain.on('speech:audio', (e, chunk: Uint8Array) =>
    speech.audio(e.sender, Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))
  )
  // Abre Ajustes do Sistema > Teclado, onde fica o Ditado. No Windows, a permissão do microfone.
  ipcMain.on('speech:openSettings', () =>
    shell.openExternal(IS_WIN ? 'ms-settings:privacy-microphone' : 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension')
  )
  ipcMain.on('popout:open', (_e, id: string, payload: unknown) => popouts.show(id, payload))
  ipcMain.handle('popout:payload', (_e, id: string) => popouts.payload(id))
  ipcMain.on('theme:set', (_e, theme: 'dark' | 'light' | 'system') => {
    nativeTheme.themeSource = theme
    repaintOverlays()
  })
  nativeTheme.on('updated', repaintOverlays)
  // Cor de destaque do sistema (Ajustes > Aparência no Mac, Personalização > Cores no Windows): a
  // interface usa nela o item selecionado e os botões ligados.
  ipcMain.on('accent:get', (e) => {
    e.returnValue = accentColor()
  })
  const sendAccent = () => broadcast('accent:changed', accentColor())
  if (IS_MAC) systemPreferences.subscribeNotification('AppleColorPreferencesChangedNotification', sendAccent)
  else systemPreferences.on('accent-color-changed', sendAccent)
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
  ipcMain.handle('sessions:trash', (_e, path: string, id: string) => trashSession(path, id))
  ipcMain.handle('sessions:branch', (_e, path: string) => currentBranch(path))
  ipcMain.handle('sessions:repoUrl', (_e, path: string) => repoUrl(path))
  // Abre o endereço calculado aqui, não um que venha da tela.
  ipcMain.on('sessions:openRepo', (_e, path: string) => {
    void repoUrl(path).then((url) => {
      if (url) void shell.openExternal(url)
    })
  })
  ipcMain.handle('sessions:changes', (_e, path: string) => uncommittedFiles(path))
  ipcMain.on('sessions:watch', (_e, paths: string[]) => sessionWatch.setProjects(paths))
  ipcMain.handle('sessions:history', (_e, path: string, id: string) => readHistory(path, id))
  ipcMain.handle('sessions:images', (_e, path: string, id: string, messageId: string) => readImages(path, id, messageId))
  ipcMain.handle('devServers:list', (_e, paths: string[]) => listDevServers(paths))
  ipcMain.handle('devServers:kill', (_e, pgid: number, paths: string[]) => killDevServer(pgid, paths))
  ipcMain.handle('projectServers:status', (_e, paths: string[]) => projectServers(paths))
  ipcMain.handle('projectServers:start', (_e, path: string) => startProjectServer(path))
  ipcMain.handle('projectServers:stop', (_e, path: string) => stopProjectServer(path))
  ipcMain.handle('files:list', (_e, root: string, rel: string) => listDir(root, rel))
  ipcMain.handle('files:read', (_e, root: string, rel: string) => readFile(root, rel))
  ipcMain.handle('files:diff', (_e, root: string, rel: string) => fileDiff(root, rel))
  ipcMain.handle('files:write', (_e, root: string, rel: string, text: string) => writeFile(root, rel, text))
  ipcMain.handle('files:create', (_e, root: string, dir: string, name: string, isDir: boolean) =>
    createItem(root, dir, name, isDir)
  )
  ipcMain.handle('files:rename', (_e, root: string, rel: string, name: string) => renameItem(root, rel, name))
  ipcMain.handle('files:trash', (_e, root: string, rel: string) => trashItem(root, rel))
  ipcMain.handle('files:copy', (_e, root: string, rels: string[]) => copyToClipboard(root, rels))
  ipcMain.handle('files:paste', (_e, root: string, dir: string) => pasteFromClipboard(root, dir))
  ipcMain.on('files:reveal', (_e, root: string, rel: string) => revealItem(root, rel))
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
  ipcMain.handle('mcp:status', (_e, key: string, cwd: string, account?: string) => chats.mcpStatus(key, cwd, account))
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
  ipcMain.on('updates:install', () => void restartToUpdate())
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
  // Os monitores de uso sobem quando o login de cada conta é conferido.
  cleanupAccounts()
  void auth.refresh()
  cli.start()
  updater.start()
  setMenuBarIcon(loadAppSettings().menuBarIcon)
  app.on('browser-window-focus', () => tray?.seen())
  createWindow()
  if (SMOKE_TEST && mainWindow) {
    // Sai pelo mesmo caminho de quem fecha a janela, já confirmado.
    runSmokeTest(mainWindow, terminals, () => canvasReady, () => {
      quitConfirmed = true
      app.quit()
    })
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Encerra tudo que o app abriu (claude, terminais, ditado, servidores de projeto) para não sobrar processo solto.
// quitting: o app está fechando de verdade; a janela do canvas já pode fechar (ver createWindow).
let quitting = false
function shutdown(): void {
  quitting = true
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

// Fechar o app derruba as conversas e os terminais no meio do que estão fazendo. Com algo em
// andamento, pede confirmação antes; sem nada rodando, fecha direto.
let quitConfirmed = false
let asking: Promise<boolean> | null = null

function inProgress(): string[] {
  const chatting = chats
    .list()
    .filter((c) => c.state.status !== 'idle' || c.state.agents.length > 0)
    .map((c) => `Conversa em ${basename(c.cwd)}`)
  const running = terminals.busy().map((cwd) => `Terminal em ${basename(cwd)}`)
  return [...chatting, ...running]
}

async function askToClose(update: boolean, items: string[]): Promise<boolean> {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    message: update
      ? 'Atualizar agora interrompe o que está rodando.'
      : 'Fechar o Argus interrompe o que está rodando.',
    detail: `${items.map((i) => `- ${i}`).join('\n')}\n\nO que estiver no meio para e não continua sozinho.`,
    buttons: [update ? 'Atualizar mesmo assim' : 'Fechar mesmo assim', 'Cancelar'],
    defaultId: 1,
    cancelId: 1
  })
  return response === 0
}

// ⌘Q repetido com a pergunta aberta não abre outra.
function confirmClose(update: boolean, items: string[]): Promise<boolean> {
  asking ??= askToClose(update, items).finally(() => (asking = null))
  return asking
}

// Windows: os shells dos terminais com algum comando rodando (ver Terminals.busyShells).
async function busyShells(): Promise<string[]> {
  return (await terminals.busyShells()).map((cwd) => `Terminal em ${basename(cwd)}`)
}

// Só troca o app depois do sim: o script da troca reabre o Argus assim que o processo sai.
async function restartToUpdate(): Promise<void> {
  const items = [...inProgress(), ...(await busyShells())]
  if (!updater.pending || (items.length && !(await confirmClose(true, items)))) return
  quitConfirmed = true
  if (!updater.install(true)) quitConfirmed = false
}

// Windows: depois do shutdown, a saída espera os terminais terminarem de fechar (ver
// Terminals.closed); as janelas somem na hora. No Mac não há o que esperar.
let draining = false
let drained = false
function finishQuit(e: { preventDefault: () => void }): void {
  shutdown()
  if (!terminals.hasClosing()) return
  e.preventDefault()
  draining = true
  for (const w of BrowserWindow.getAllWindows()) w.hide()
  void terminals.closed().then(() => {
    drained = true
    app.quit()
  })
}

// Para os sinais do modo de desenvolvimento: sai na hora, depois de os terminais fecharem. Um
// segundo sinal no meio disso não repete o shutdown.
function exitNow(): void {
  if (draining) return
  shutdown()
  if (!terminals.hasClosing()) return app.exit(0)
  draining = true
  void terminals.closed().then(() => app.exit(0))
}

// Decidido na hora: adiar a saída sem motivo faria o macOS acusar o Argus de travar o desligamento.
// No Windows, saber se o shell de um terminal está rodando algo leva um instante; com terminal
// aberto, a saída espera essa conferência.
let checkingShells = false
app.on('before-quit', (e) => {
  if (drained) return
  // Fechar de novo enquanto os terminais fecham não repete o shutdown.
  if (draining) return e.preventDefault()
  const items = quitConfirmed ? [] : inProgress()
  const checkShells = !quitConfirmed && terminals.hasShells()
  if (!items.length && !checkShells) return finishQuit(e)
  e.preventDefault()
  // Fechar de novo enquanto a conferência roda não abre outra.
  if (checkingShells) return
  checkingShells = true
  void (async () => {
    const all = checkShells ? [...items, ...(await busyShells())] : items
    checkingShells = false
    if (all.length && !(await confirmClose(false, all))) return
    quitConfirmed = true
    app.quit()
  })()
})

// O modo de desenvolvimento reinicia o app com SIGTERM a cada mudança no processo principal.
// Sem tratar o sinal, um app ainda abrindo podia ignorá-lo e ficar aberto ao lado do novo.
process.on('SIGTERM', exitNow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') return app.quit()
  // No macOS o app segue no Dock; sem janela, nada precisa de sessão de chat aberta.
  chats.releaseAll()
})

// Ctrl+C no terminal que subiu o app também encerra tudo que ele abriu.
process.on('SIGINT', exitNow)
