import { homedir } from 'node:os'
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { AgentDef, AgentDraftRequest, AgentDraftResult, AgentSaveRequest, AgentSaveResult } from '../shared/agents'
import type { CanvasAgentState, CanvasToolCall, CanvasToolResult } from '../shared/canvasAgent'
import type { ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from '../shared/chat'
import type { CliStatus } from '../shared/cli'
import type { AppSettings } from '../shared/appSettings'
import type { DevServer } from '../shared/devServers'
import type { McpStatus } from '../shared/mcp'
import type { FileContent, FileDiff, FileEntry } from '../shared/files'
import type { ClaudeInfo } from '../shared/models'
import type { TerminalOpenRequest, TerminalOpenResult } from '../shared/terminal'
import type { Message } from '../shared/history'
import type { MemoryGroup, MemoryProject } from '../shared/memory'
import type { KnownFolder, SessionSummary, UncommittedFile } from '../shared/sessions'
import type { SpeechEvent } from '../shared/speech'
import type { Usage } from '../shared/usage'

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  homeDir: homedir(),
  setTheme: (theme: 'dark' | 'light' | 'system') => ipcRenderer.send('theme:set', theme),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  onEdit: (cb: (action: 'undo' | 'redo') => void) => {
    const listener = (_e: IpcRendererEvent, action: 'undo' | 'redo') => cb(action)
    ipcRenderer.on('edit', listener)
    return () => ipcRenderer.removeListener('edit', listener)
  },
  speech: {
    start: () => ipcRenderer.send('speech:start'),
    stop: () => ipcRenderer.send('speech:stop'),
    openSettings: () => ipcRenderer.send('speech:openSettings'),
    onEvent: (cb: (event: SpeechEvent) => void) => {
      const listener = (_e: IpcRendererEvent, event: SpeechEvent) => cb(event)
      ipcRenderer.on('speech:event', listener)
      return () => ipcRenderer.removeListener('speech:event', listener)
    }
  },
  popout: {
    open: (id: string, payload: unknown) => ipcRenderer.send('popout:open', id, payload),
    payload: (id: string): Promise<unknown> => ipcRenderer.invoke('popout:payload', id),
    onClosed: (cb: (id: string) => void) => {
      const listener = (_e: IpcRendererEvent, id: string) => cb(id)
      ipcRenderer.on('popout:closed', listener)
      return () => ipcRenderer.removeListener('popout:closed', listener)
    },
    sendSettings: (id: string, settings: unknown) => ipcRenderer.send('conversation:settings', id, settings),
    onSettings: (cb: (id: string, settings: unknown) => void) => {
      const listener = (_e: IpcRendererEvent, id: string, settings: unknown) => cb(id, settings)
      ipcRenderer.on('conversation:settings', listener)
      return () => ipcRenderer.removeListener('conversation:settings', listener)
    }
  },
  claude: {
    info: (): Promise<ClaudeInfo | null> => ipcRenderer.invoke('claude:info'),
    onInfo: (cb: (info: ClaudeInfo) => void) => {
      const listener = (_e: IpcRendererEvent, info: ClaudeInfo) => cb(info)
      ipcRenderer.on('claude:info', listener)
      return () => ipcRenderer.removeListener('claude:info', listener)
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
    mcpStatus: (key: string, cwd: string): Promise<McpStatus> => ipcRenderer.invoke('mcp:status', key, cwd),
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
  // Servidores locais que algum Claude Code deixou rodando.
  devServers: {
    list: (): Promise<DevServer[]> => ipcRenderer.invoke('devServers:list'),
    kill: (pgid: number): Promise<boolean> => ipcRenderer.invoke('devServers:kill', pgid)
  },
  files: {
    list: (root: string, rel: string): Promise<FileEntry[]> => ipcRenderer.invoke('files:list', root, rel),
    read: (root: string, rel: string): Promise<FileContent> => ipcRenderer.invoke('files:read', root, rel),
    diff: (root: string, rel: string): Promise<FileDiff> => ipcRenderer.invoke('files:diff', root, rel),
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
  // Comando `cae` do terminal.
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
  usage: {
    get: (): Promise<Usage | null> => ipcRenderer.invoke('usage:get'),
    onUpdate: (cb: (usage: Usage) => void) => {
      const listener = (_e: IpcRendererEvent, usage: Usage) => cb(usage)
      ipcRenderer.on('usage:update', listener)
      return () => ipcRenderer.removeListener('usage:update', listener)
    }
  }
})
