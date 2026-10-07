import type { AgentDef, AgentDraftRequest, AgentDraftResult, AgentSaveRequest, AgentSaveResult } from '../shared/agents'
import type { CanvasAgentState, CanvasToolCall, CanvasToolResult } from '../shared/canvasAgent'
import type { ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from '../shared/chat'
import type { McpStatus } from '../shared/mcp'
import type { FileContent, FileDiff, FileEntry } from '../shared/files'
import type { ClaudeInfo } from '../shared/models'
import type { TerminalOpenRequest, TerminalOpenResult } from '../shared/terminal'
import type { CliStatus } from '../shared/cli'
import type { AppSettings } from '../shared/appSettings'
import type { AuthState, LoginMethod } from '../shared/auth'
import type { UpdateInfo, UpdateState } from '../shared/updates'
import type { DevServer, ProjectServer } from '../shared/devServers'
import type { Message } from '../shared/history'
import type { MemoryGroup, MemoryProject } from '../shared/memory'
import type { KnownFolder, SessionSummary, UncommittedFile } from '../shared/sessions'
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
      }
      claude: {
        info: () => Promise<ClaudeInfo | null>
        onInfo: (cb: (info: ClaudeInfo) => void) => () => void
      }
      auth: {
        state: () => Promise<AuthState>
        login: (method: LoginMethod) => void
        submitCode: (code: string) => void
        cancel: () => void
        logout: () => Promise<boolean>
        open: (url: string) => void
        onState: (cb: (state: AuthState) => void) => () => void
      }
      filePath: (file: File) => string
      chat: {
        state: (key: string) => Promise<ChatState | null>
        send: (req: ChatSendRequest) => void
        remoteControl: (req: ChatRemoteRequest) => void
        answer: (key: string, id: string, answer: PermissionAnswer) => void
        interrupt: (key: string) => void
        retain: (key: string) => void
        mcpStatus: (key: string, cwd: string) => Promise<McpStatus>
        release: (key: string) => void
        configure: (key: string, patch: Partial<ChatSettings>) => void
        onState: (cb: (key: string, state: ChatState) => void) => () => void
        onOpen: (cb: (cwd: string, sessionId: string) => void) => () => void
      }
      agents: {
        list: (projectPath?: string) => Promise<AgentDef[]>
        save: (req: AgentSaveRequest) => Promise<AgentSaveResult>
        remove: (name: string) => Promise<boolean>
        draft: (req: AgentDraftRequest) => Promise<AgentDraftResult>
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
      canvasAgent: {
        state: () => Promise<CanvasAgentState>
        send: (text: string) => void
        interrupt: () => void
        onState: (cb: (state: CanvasAgentState) => void) => () => void
        onCall: (cb: (call: CanvasToolCall) => void) => () => void
        respond: (result: CanvasToolResult) => void
      }
      sessions: {
        list: (path: string) => Promise<SessionSummary[]>
        // Pastas onde o Claude Code já conversou, da mais recente para a mais antiga.
        folders: () => Promise<KnownFolder[]>
        // Branch atual do git da pasta; nulo fora de repositório. O aviso onChanged cobre a troca.
        branch: (path: string) => Promise<string | null>
        // Arquivos não comitados do repositório da pasta; nulo fora de repositório.
        changes: (path: string) => Promise<UncommittedFile[] | null>
        history: (path: string, id: string) => Promise<Message[]>
        // Imagens de uma mensagem sua (data URLs), lidas só quando o preview abre.
        images: (path: string, id: string, messageId: string) => Promise<string[]>
        watch: (paths: string[]) => void
        onChanged: (cb: (path: string) => void) => () => void
      }
      devServers: {
        list: () => Promise<DevServer[]>
        kill: (pgid: number) => Promise<boolean>
      }
      projectServers: {
        status: (paths: string[]) => Promise<Record<string, ProjectServer>>
        start: (path: string) => Promise<boolean>
        stop: (path: string) => Promise<boolean>
      }
      files: {
        list: (root: string, rel: string) => Promise<FileEntry[]>
        read: (root: string, rel: string) => Promise<FileContent>
        // Mudanças do arquivo desde o último commit.
        diff: (root: string, rel: string) => Promise<FileDiff>
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
      cli: {
        ready: () => void
        onOpen: (cb: (path: string) => void) => () => void
        status: () => Promise<CliStatus>
        install: () => Promise<CliStatus>
        uninstall: () => Promise<CliStatus>
      }
      settings: {
        get: () => Promise<AppSettings>
        setMenuBarIcon: (on: boolean) => Promise<AppSettings>
      }
      updates: {
        get: () => Promise<UpdateInfo>
        check: () => Promise<UpdateState>
        install: () => void
        onState: (cb: (state: UpdateState) => void) => () => void
      }
      usage: {
        get: () => Promise<Usage | null>
        onUpdate: (cb: (usage: Usage) => void) => () => void
      }
    }
  }
}
