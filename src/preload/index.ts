import { homedir } from 'node:os'
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { AgentDef, AgentDraftRequest, AgentDraftResult, AgentSaveRequest, AgentSaveResult } from '../shared/agents'
import type { CanvasAgentState, CanvasToolCall, CanvasToolResult } from '../shared/canvasAgent'
import type { ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from '../shared/chat'
import type { CliStatus } from '../shared/cli'
import type { AppSettings } from '../shared/appSettings'
import type { AuthState, LoginMethod } from '../shared/auth'
import type { DevServer, ProjectServer } from '../shared/devServers'
import type { McpStatus } from '../shared/mcp'
import type { FileContent, FileDiff, FileEntry, FileOpResult } from '../shared/files'
import type { ClaudeInfo } from '../shared/models'
import type { TerminalOpenRequest, TerminalOpenResult } from '../shared/terminal'
import type { Message } from '../shared/history'
import type { MemoryGroup, MemoryProject } from '../shared/memory'
import type { KnownFolder, SessionSummary, UncommittedFile } from '../shared/sessions'
import type { SpeechEvent } from '../shared/speech'
import type { UpdateInfo, UpdateState } from '../shared/updates'
import type { Usage } from '../shared/usage'
import { winMic } from './winMic'

const IS_WIN = process.platform === 'win32'

// Desfazer e refazer. No Mac chegam pelo menu Editar (⌘Z, ⇧⌘Z). O Windows não tem menu: Ctrl+Z,
// Ctrl+Shift+Z e Ctrl+Y fazem o papel dele e chegam do mesmo jeito. Sem ninguém escutando (janela
// de conversa) ou no terminal e no editor de código, que têm o desfazer deles, a tecla segue normal.
type EditAction = 'undo' | 'redo'
const editListeners = new Set<(action: EditAction) => void>()
ipcRenderer.on('edit', (_e, action: EditAction) => editListeners.forEach((l) => l(action)))
if (IS_WIN) {
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.ctrlKey || e.altKey || e.metaKey || !editListeners.size) return
      const key = e.key.toLowerCase()
      const action: EditAction | null = key === 'z' ? (e.shiftKey ? 'redo' : 'undo') : key === 'y' && !e.shiftKey ? 'redo' : null
      if (!action || (e.target as Element | null)?.closest?.('.xterm, .cm-editor')) return
      e.preventDefault()
      editListeners.forEach((l) => l(action))
    },
    true
  )
}

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  homeDir: homedir(),
  setTheme: (theme: 'dark' | 'light' | 'system') => ipcRenderer.send('theme:set', theme),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  onEdit: (cb: (action: EditAction) => void) => {
    editListeners.add(cb)
    return () => {
      editListeners.delete(cb)
    }
  },
  // No Windows o microfone é gravado aqui mesmo (winMic); no Mac, pelo programa native/speech.
  speech: {
    start: () => (IS_WIN ? void winMic.start() : ipcRenderer.send('speech:start')),
    stop: () => {
      if (IS_WIN) winMic.stop()
      ipcRenderer.send('speech:stop')
    },
    openSettings: () => ipcRenderer.send('speech:openSettings'),
    onEvent: (cb: (event: SpeechEvent) => void) => {
      const listener = (_e: IpcRendererEvent, event: SpeechEvent) => cb(event)
      ipcRenderer.on('speech:event', listener)
      const offMic = IS_WIN ? winMic.onEvent(cb) : () => {}
      return () => {
        ipcRenderer.removeListener('speech:event', listener)
        offMic()
      }
    }
  },
  popout: {
    open: (id: string, payload: unknown) => ipcRenderer.send('popout:open', id, payload),
    payload: (id: string): Promise<unknown> => ipcRenderer.invoke('popout:payload', id),
    onClosed: (cb: (id: string) => void) => {
      const listener = (_e: IpcRendererEvent, id: string) => cb(id)
      ipcRenderer.on('popout:closed', listener)
      return () => ipcRenderer.removeListener('popout:closed', listener)
    }
  },
  // Modelos e modo padrão que o `claude` de cada conta informa; sem conta, a padrão.
  claude: {
    info: (account?: string): Promise<ClaudeInfo | null> => ipcRenderer.invoke('claude:info', account),
    onInfo: (cb: (account: string, info: ClaudeInfo) => void) => {
      const listener = (_e: IpcRendererEvent, account: string, info: ClaudeInfo) => cb(account, info)
      ipcRenderer.on('claude:info', listener)
      return () => ipcRenderer.removeListener('claude:info', listener)
    }
  },
  // Contas do Claude Code: a principal (a mesma do terminal e do VS Code) e as que têm pasta própria.
  auth: {
    state: (): Promise<AuthState> => ipcRenderer.invoke('auth:state'),
    refresh: () => ipcRenderer.send('auth:refresh'),
    install: () => ipcRenderer.send('auth:install'),
    login: (accountId: string, method: LoginMethod) => ipcRenderer.send('auth:login', accountId, method),
    add: (method: LoginMethod) => ipcRenderer.send('auth:add', method),
    submitCode: (code: string) => ipcRenderer.send('auth:code', code),
    cancel: () => ipcRenderer.send('auth:cancel'),
    logout: (): Promise<boolean> => ipcRenderer.invoke('auth:logout'),
    remove: (accountId: string): Promise<boolean> => ipcRenderer.invoke('auth:remove', accountId),
    rename: (accountId: string, name: string) => ipcRenderer.send('auth:rename', accountId, name),
    setDefault: (accountId: string) => ipcRenderer.send('auth:setDefault', accountId),
    open: (url: string) => ipcRenderer.send('auth:open', url),
    onState: (cb: (state: AuthState) => void) => {
      const listener = (_e: IpcRendererEvent, state: AuthState) => cb(state)
      ipcRenderer.on('auth:state', listener)
      return () => ipcRenderer.removeListener('auth:state', listener)
    }
  },
  // Caminho no disco de um arquivo escolhido ou arrastado (anexos do chat).
  filePath: (file: File): string => webUtils.getPathForFile(file),
  chat: {
    state: (key: string): Promise<ChatState | null> => ipcRenderer.invoke('chat:state', key),
    send: (req: ChatSendRequest) => ipcRenderer.send('chat:send', req),
    remoteControl: (req: ChatRemoteRequest) => ipcRenderer.send('chat:remote-control', req),
    answer: (key: string, id: string, answer: PermissionAnswer) => ipcRenderer.send('chat:answer', key, id, answer),
    interrupt: (key: string) => ipcRenderer.send('chat:interrupt', key),
    retain: (key: string) => ipcRenderer.send('chat:retain', key),
    mcpStatus: (key: string, cwd: string, account?: string): Promise<McpStatus> =>
      ipcRenderer.invoke('mcp:status', key, cwd, account),
    release: (key: string) => ipcRenderer.send('chat:release', key),
    configure: (key: string, patch: Partial<ChatSettings>) => ipcRenderer.send('chat:configure', key, patch),
    onState: (cb: (key: string, state: ChatState) => void) => {
      const listener = (_e: IpcRendererEvent, key: string, state: ChatState) => cb(key, state)
      ipcRenderer.on('chat:state', listener)
      return () => ipcRenderer.removeListener('chat:state', listener)
    },
    // Clique na notificação do sistema.
    onOpen: (cb: (cwd: string, sessionId: string) => void) => {
      const listener = (_e: IpcRendererEvent, cwd: string, sessionId: string) => cb(cwd, sessionId)
      ipcRenderer.on('chat:open', listener)
      return () => ipcRenderer.removeListener('chat:open', listener)
    }
  },
  // Biblioteca de agentes (~/.claude/agents). Com a pasta, inclui os do projeto.
  agents: {
    list: (projectPath?: string): Promise<AgentDef[]> => ipcRenderer.invoke('agents:list', projectPath),
    save: (req: AgentSaveRequest): Promise<AgentSaveResult> => ipcRenderer.invoke('agents:save', req),
    remove: (name: string): Promise<boolean> => ipcRenderer.invoke('agents:remove', name),
    // O Claude preenche os campos a partir de uma descrição (falada ou escrita).
    draft: (req: AgentDraftRequest): Promise<AgentDraftResult> => ipcRenderer.invoke('agents:draft', req)
  },
  memory: {
    list: (projects: MemoryProject[]): Promise<MemoryGroup[]> => ipcRenderer.invoke('memory:list', projects),
    read: (path: string, projects: MemoryProject[]): Promise<string | null> =>
      ipcRenderer.invoke('memory:read', path, projects),
    write: (path: string, text: string, projects: MemoryProject[]): Promise<boolean> =>
      ipcRenderer.invoke('memory:write', path, text, projects)
  },
  canvas: {
    // Síncrono: o canvas já abre com o que estava salvo, sem piscar vazio.
    load: (): unknown => ipcRenderer.sendSync('canvas:load'),
    save: (data: unknown): Promise<void> => ipcRenderer.invoke('canvas:save', data)
  },
  canvasAgent: {
    state: (): Promise<CanvasAgentState> => ipcRenderer.invoke('canvasAgent:state'),
    send: (text: string) => ipcRenderer.send('canvasAgent:send', text),
    interrupt: () => ipcRenderer.send('canvasAgent:interrupt'),
    onState: (cb: (state: CanvasAgentState) => void) => {
      const listener = (_e: IpcRendererEvent, state: CanvasAgentState) => cb(state)
      ipcRenderer.on('canvasAgent:state', listener)
      return () => ipcRenderer.removeListener('canvasAgent:state', listener)
    },
    // Ações que o Claude pede; a resposta volta por respond.
    onCall: (cb: (call: CanvasToolCall) => void) => {
      const listener = (_e: IpcRendererEvent, call: CanvasToolCall) => cb(call)
      ipcRenderer.on('canvasAgent:call', listener)
      return () => ipcRenderer.removeListener('canvasAgent:call', listener)
    },
    respond: (result: CanvasToolResult) => ipcRenderer.send('canvasAgent:result', result)
  },
  sessions: {
    list: (path: string): Promise<SessionSummary[]> => ipcRenderer.invoke('sessions:list', path),
    folders: (): Promise<KnownFolder[]> => ipcRenderer.invoke('sessions:folders'),
    trash: (path: string, id: string): Promise<string | null> => ipcRenderer.invoke('sessions:trash', path, id),
    branch: (path: string): Promise<string | null> => ipcRenderer.invoke('sessions:branch', path),
    changes: (path: string): Promise<UncommittedFile[] | null> => ipcRenderer.invoke('sessions:changes', path),
    history: (path: string, id: string): Promise<Message[]> => ipcRenderer.invoke('sessions:history', path, id),
    images: (path: string, id: string, messageId: string): Promise<string[]> =>
      ipcRenderer.invoke('sessions:images', path, id, messageId),
    watch: (paths: string[]) => ipcRenderer.send('sessions:watch', paths),
    onChanged: (cb: (path: string) => void) => {
      const listener = (_e: IpcRendererEvent, path: string) => cb(path)
      ipcRenderer.on('sessions:changed', listener)
      return () => ipcRenderer.removeListener('sessions:changed', listener)
    }
  },
  // Servidores locais: os que o Claude Code ou o play deixaram rodando e qualquer porta aberta
  // dentro das pastas do canvas (`paths`).
  devServers: {
    list: (paths: string[]): Promise<DevServer[]> => ipcRenderer.invoke('devServers:list', paths),
    kill: (pgid: number, paths: string[]): Promise<boolean> => ipcRenderer.invoke('devServers:kill', pgid, paths)
  },
  // Servidor de cada pasta do canvas: rodando (venha de onde vier) e iniciar/encerrar.
  projectServers: {
    status: (paths: string[]): Promise<Record<string, ProjectServer>> =>
      ipcRenderer.invoke('projectServers:status', paths),
    start: (path: string): Promise<boolean> => ipcRenderer.invoke('projectServers:start', path),
    stop: (path: string): Promise<boolean> => ipcRenderer.invoke('projectServers:stop', path)
  },
  files: {
    list: (root: string, rel: string): Promise<FileEntry[]> => ipcRenderer.invoke('files:list', root, rel),
    read: (root: string, rel: string): Promise<FileContent> => ipcRenderer.invoke('files:read', root, rel),
    diff: (root: string, rel: string): Promise<FileDiff> => ipcRenderer.invoke('files:diff', root, rel),
    write: (root: string, rel: string, text: string): Promise<FileOpResult> =>
      ipcRenderer.invoke('files:write', root, rel, text),
    create: (root: string, dir: string, name: string, isDir: boolean): Promise<FileOpResult> =>
      ipcRenderer.invoke('files:create', root, dir, name, isDir),
    rename: (root: string, rel: string, name: string): Promise<FileOpResult> =>
      ipcRenderer.invoke('files:rename', root, rel, name),
    trash: (root: string, rel: string): Promise<FileOpResult> => ipcRenderer.invoke('files:trash', root, rel),
    copy: (root: string, rels: string[]): Promise<void> => ipcRenderer.invoke('files:copy', root, rels),
    paste: (root: string, dir: string): Promise<FileOpResult> => ipcRenderer.invoke('files:paste', root, dir),
    reveal: (root: string, rel: string) => ipcRenderer.send('files:reveal', root, rel),
    watch: (root: string, rel: string) => ipcRenderer.send('files:watch', root, rel),
    unwatch: () => ipcRenderer.send('files:unwatch'),
    onChanged: (cb: (root: string, rel: string) => void) => {
      const listener = (_e: IpcRendererEvent, root: string, rel: string) => cb(root, rel)
      ipcRenderer.on('files:changed', listener)
      return () => ipcRenderer.removeListener('files:changed', listener)
    }
  },
  terminal: {
    open: (req: TerminalOpenRequest): Promise<TerminalOpenResult> => ipcRenderer.invoke('terminal:open', req),
    write: (key: string, data: string) => ipcRenderer.send('terminal:write', key, data),
    rename: (oldKey: string, newKey: string) => ipcRenderer.send('terminal:rename', oldKey, newKey),
    resize: (key: string, cols: number, rows: number) => ipcRenderer.send('terminal:resize', key, cols, rows),
    kill: (key: string) => ipcRenderer.send('terminal:kill', key),
    onData: (cb: (key: string, data: string) => void) => {
      const listener = (_e: IpcRendererEvent, key: string, data: string) => cb(key, data)
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },
    onExit: (cb: (key: string, code: number) => void) => {
      const listener = (_e: IpcRendererEvent, key: string, code: number) => cb(key, code)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    }
  },
  // Comando `argus` do terminal.
  cli: {
    ready: () => ipcRenderer.send('cli:ready'),
    onOpen: (cb: (path: string) => void) => {
      const listener = (_e: IpcRendererEvent, path: string) => cb(path)
      ipcRenderer.on('cli:open', listener)
      return () => ipcRenderer.removeListener('cli:open', listener)
    },
    status: (): Promise<CliStatus> => ipcRenderer.invoke('cli:status'),
    install: (): Promise<CliStatus> => ipcRenderer.invoke('cli:install'),
    uninstall: (): Promise<CliStatus> => ipcRenderer.invoke('cli:uninstall')
  },
  // Preferências guardadas no processo principal.
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    setMenuBarIcon: (on: boolean): Promise<AppSettings> => ipcRenderer.invoke('settings:menuBarIcon', on)
  },
  // Atualização do app pelos releases do GitHub.
  updates: {
    get: (): Promise<UpdateInfo> => ipcRenderer.invoke('updates:get'),
    check: (): Promise<UpdateState> => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.send('updates:install'),
    onState: (cb: (state: UpdateState) => void) => {
      const listener = (_e: IpcRendererEvent, state: UpdateState) => cb(state)
      ipcRenderer.on('updates:state', listener)
      return () => ipcRenderer.removeListener('updates:state', listener)
    }
  },
  // Limites de cada conta logada; nulo quando a conta sai ou é removida.
  usage: {
    get: (): Promise<Record<string, Usage>> => ipcRenderer.invoke('usage:get'),
    onUpdate: (cb: (account: string, usage: Usage | null) => void) => {
      const listener = (_e: IpcRendererEvent, account: string, usage: Usage | null) => cb(account, usage)
      ipcRenderer.on('usage:update', listener)
      return () => ipcRenderer.removeListener('usage:update', listener)
    }
  }
})
