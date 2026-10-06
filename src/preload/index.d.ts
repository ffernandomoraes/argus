import type { ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from '../shared/chat'
import type { FileContent, FileEntry } from '../shared/files'
import type { ClaudeInfo } from '../shared/models'
import type { TerminalOpenRequest, TerminalOpenResult } from '../shared/terminal'
import type { Message } from '../shared/history'
import type { MemoryGroup, MemoryProject } from '../shared/memory'
import type { SessionSummary } from '../shared/sessions'
import type { SpeechEvent } from '../shared/speech'
import type { Usage } from '../shared/usage'

declare global {
  interface Window {
    api: {
      platform: string
      homeDir: string
      setTheme: (theme: 'dark' | 'light' | 'system') => void
      pickFolder: () => Promise<string | null>
      onEdit: (cb: (action: 'undo' | 'redo') => void) => () => void
      speech: {
        start: () => void
        stop: () => void
        openSettings: () => void
        onEvent: (cb: (event: SpeechEvent) => void) => () => void
      }
      popout: {
        open: (id: string, payload: unknown) => void
        payload: (id: string) => Promise<unknown>
        onClosed: (cb: (id: string) => void) => () => void
        sendSettings: (id: string, settings: unknown) => void
        onSettings: (cb: (id: string, settings: unknown) => void) => () => void
      }
      claude: {
        info: () => Promise<ClaudeInfo | null>
        onInfo: (cb: (info: ClaudeInfo) => void) => () => void
      }
      filePath: (file: File) => string
      chat: {
        state: (key: string) => Promise<ChatState | null>
        send: (req: ChatSendRequest) => void
        answer: (key: string, id: string, answer: PermissionAnswer) => void
        interrupt: (key: string) => void
        retain: (key: string) => void
        release: (key: string) => void
        configure: (key: string, patch: Partial<ChatSettings>) => void
        onState: (cb: (key: string, state: ChatState) => void) => () => void
      }
      memory: {
        list: (projects: MemoryProject[]) => Promise<MemoryGroup[]>
        read: (path: string, projects: MemoryProject[]) => Promise<string | null>
        write: (path: string, text: string, projects: MemoryProject[]) => Promise<boolean>
      }
      canvas: {
        load: () => unknown
        save: (data: unknown) => Promise<void>
      }
      sessions: {
        list: (path: string) => Promise<SessionSummary[]>
        history: (path: string, id: string) => Promise<Message[]>
        watch: (paths: string[]) => void
        onChanged: (cb: (path: string) => void) => () => void
        search: (path: string, query: string) => Promise<{ id: string; snippet: string }[]>
      }
      files: {
        list: (root: string, rel: string) => Promise<FileEntry[]>
        read: (root: string, rel: string) => Promise<FileContent>
        watch: (root: string, rel: string) => void
        unwatch: () => void
        onChanged: (cb: (root: string, rel: string) => void) => () => void
      }
      terminal: {
        open: (req: TerminalOpenRequest) => Promise<TerminalOpenResult>
        write: (key: string, data: string) => void
        rename: (oldKey: string, newKey: string) => void
        resize: (key: string, cols: number, rows: number) => void
        kill: (key: string) => void
        onData: (cb: (key: string, data: string) => void) => () => void
        onExit: (cb: (key: string, code: number) => void) => () => void
      }
      usage: {
        get: () => Promise<Usage | null>
        onUpdate: (cb: (usage: Usage) => void) => () => void
      }
    }
  }
}
