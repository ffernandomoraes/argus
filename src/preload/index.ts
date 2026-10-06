import { homedir } from 'node:os'
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from '../shared/chat'
import type { FileContent, FileEntry } from '../shared/files'
import type { ClaudeInfo } from '../shared/models'
import type { TerminalOpenRequest, TerminalOpenResult } from '../shared/terminal'
import type { Message } from '../shared/history'
import type { MemoryGroup, MemoryProject } from '../shared/memory'
import type { SessionSummary } from '../shared/sessions'
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
    answer: (key: string, id: string, answer: PermissionAnswer) => ipcRenderer.send('chat:answer', key, id, answer),
    interrupt: (key: string) => ipcRenderer.send('chat:interrupt', key),
    retain: (key: string) => ipcRenderer.send('chat:retain', key),
    release: (key: string) => ipcRenderer.send('chat:release', key),
    configure: (key: string, patch: Partial<ChatSettings>) => ipcRenderer.send('chat:configure', key, patch),
    onState: (cb: (key: string, state: ChatState) => void) => {
      const listener = (_e: IpcRendererEvent, key: string, state: ChatState) => cb(key, state)
      ipcRenderer.on('chat:state', listener)
      return () => ipcRenderer.removeListener('chat:state', listener)
    }
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
  sessions: {
    list: (path: string): Promise<SessionSummary[]> => ipcRenderer.invoke('sessions:list', path),
    history: (path: string, id: string): Promise<Message[]> => ipcRenderer.invoke('sessions:history', path, id),
    watch: (paths: string[]) => ipcRenderer.send('sessions:watch', paths),
    onChanged: (cb: (path: string) => void) => {
      const listener = (_e: IpcRendererEvent, path: string) => cb(path)
      ipcRenderer.on('sessions:changed', listener)
      return () => ipcRenderer.removeListener('sessions:changed', listener)
    },
    search: (path: string, query: string): Promise<{ id: string; snippet: string }[]> =>
      ipcRenderer.invoke('sessions:search', path, query)
  },
  files: {
    list: (root: string, rel: string): Promise<FileEntry[]> => ipcRenderer.invoke('files:list', root, rel),
    read: (root: string, rel: string): Promise<FileContent> => ipcRenderer.invoke('files:read', root, rel),
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
  usage: {
    get: (): Promise<Usage | null> => ipcRenderer.invoke('usage:get'),
    onUpdate: (cb: (usage: Usage) => void) => {
      const listener = (_e: IpcRendererEvent, usage: Usage) => cb(usage)
      ipcRenderer.on('usage:update', listener)
      return () => ipcRenderer.removeListener('usage:update', listener)
    }
  }
})
