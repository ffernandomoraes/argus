import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron'
import type { ChatSendRequest, ChatSettings, PermissionAnswer } from '../shared/chat'
import type { TerminalOpenRequest } from '../shared/terminal'
import { Chats } from './chats'
import { loadCanvas, saveCanvas } from './canvasStore'
import { listDir, readFile } from './files'
import { unwatchFile, watchFile } from './fileWatch'
import { Popouts } from './popouts'
import { readHistory } from './history'
import { listMemory, readMemory, writeMemory } from './memory'
import type { MemoryProject } from '../shared/memory'
import { searchSessions } from './search'
import { SessionWatch } from './sessionWatch'
import { listSessions } from './sessions'
import { Speech } from './speech'
import { Terminals } from './terminals'
import { UsageMonitor } from './usageMonitor'

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

const terminals = new Terminals(
  (key, data) => broadcast('terminal:data', key, data),
  (key, code) => broadcast('terminal:exit', key, code)
)

const sessionWatch = new SessionWatch((path) => broadcast('sessions:changed', path))

const chats = new Chats((key, state) => broadcast('chat:state', key, state))

const usage = new UsageMonitor(
  (data) => broadcast('usage:update', data),
  (info) => broadcast('claude:info', info)
)

function loadRenderer(win: BrowserWindow, hash = ''): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
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

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#161618',
    webPreferences
  })
  openLinksOutside(win)
  loadRenderer(win)
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
      { role: 'appMenu' },
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
  ipcMain.handle('memory:list', (_e, projects: MemoryProject[]) => listMemory(projects))
  ipcMain.handle('memory:read', (_e, path: string, projects: MemoryProject[]) => readMemory(path, projects))
  ipcMain.handle('memory:write', (_e, path: string, text: string, projects: MemoryProject[]) =>
    writeMemory(path, text, projects)
  )
  ipcMain.handle('sessions:list', (_e, path: string) => listSessions(path))
  ipcMain.on('sessions:watch', (_e, paths: string[]) => sessionWatch.setProjects(paths))
  ipcMain.handle('sessions:search', (_e, path: string, query: string) => searchSessions(path, query))
  ipcMain.handle('sessions:history', (_e, path: string, id: string) => readHistory(path, id))
  ipcMain.handle('files:list', (_e, root: string, rel: string) => listDir(root, rel))
  ipcMain.handle('files:read', (_e, root: string, rel: string) => readFile(root, rel))
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
  ipcMain.on('chat:answer', (_e, key: string, id: string, answer: PermissionAnswer) => chats.answer(key, id, answer))
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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Encerra tudo que o app abriu (claude, terminais, ditado) para não sobrar processo solto.
function shutdown(): void {
  usage.stop()
  speech.stop()
  terminals.killAll()
  chats.closeAll()
  sessionWatch.close()
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
