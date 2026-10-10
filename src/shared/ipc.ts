import type { AgentDef, AgentSaveRequest, AgentSaveResult } from './agents'
import type { AppSettings } from './appSettings'
import type { AuthState, LoginMethod } from './auth'
import type { CanvasViewport } from './canvas'
import type { CanvasAgentState, CanvasToolCall, CanvasToolResult } from './canvasAgent'
import type { ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from './chat'
import type { CliStatus } from './cli'
import type { Design, DesignSummary } from './design'
import type { DevServer, ProjectServer } from './devServers'
import type { FileContent, FileDiff, FileEntry, FileOpResult } from './files'
import type { Message } from './history'
import type { McpStatus } from './mcp'
import type { MemoryGroup, MemoryProject, MemoryWriteResult } from './memory'
import type { ClaudeInfo } from './models'
import type { KnownFolder, SessionChange, SessionSummary, UncommittedFile } from './sessions'
import type { SpeechEvent } from './speech'
import type { TerminalOpenRequest, TerminalOpenResult } from './terminal'
import type { UpdateInfo, UpdateState } from './updates'
import type { Usage } from './usage'

// Contrato dos canais entre o processo principal e a janela, num lugar só. O main registra cada
// canal com handle/on/onSync (src/main/ipc/register.ts) e o preload chama com invoke/send/sendSync/
// listen (src/preload/ipc.ts), os dois tipados por estes mapas: um handler que não bate com o
// canal é erro de tipo. Cada canal é escrito como a função que a janela chama.
//
// Canal novo: (1) a linha no mapa daqui; (2) o handler em src/main/ipc/<assunto>.ts; (3) a função
// em src/shared/api.ts (o formato de window.api); (4) a implementação em src/preload/index.ts. O
// typecheck acusa o que não bater entre os quatro.

export type ThemeSource = 'dark' | 'light' | 'system'
// Desfazer e refazer que chegam do menu Editar (Mac) ou do Ctrl+Z (Windows, ver preload/keys.ts).
export type EditAction = 'undo' | 'redo'
// Comentários na página do protótipo: liga ou desliga o clique que marca o ponto, tira um ou todos.
export type DesignCommentAction = 'on' | 'off' | 'remove' | 'clear'
// Rota do projeto lida do código, para a lista do endereço do modo design.
export type DesignRoute = { route: string; from: string }

// Pedidos com resposta: ipcRenderer.invoke ↔ ipcMain.handle.
export type InvokeChannels = {
  'dialog:pickFolder': () => string | null
  'settings:get': () => AppSettings
  'settings:menuBarIcon': (on: boolean) => AppSettings
  'updates:get': () => UpdateInfo
  'updates:check': () => UpdateState
  'popout:payload': (id: string) => unknown
  'usage:get': () => Record<string, Usage>
  'claude:info': (account?: string) => ClaudeInfo | null
  'cli:status': () => CliStatus
  'cli:install': () => CliStatus
  'cli:uninstall': () => CliStatus
  // Contas
  'auth:state': () => AuthState
  'auth:logout': () => boolean
  'auth:remove': (accountId: string) => boolean
  // Conversas
  'chat:state': (key: string) => ChatState | null
  'mcp:status': (key: string, cwd: string, account?: string) => McpStatus
  'agents:list': (projectPath?: string) => AgentDef[]
  'agents:save': (req: AgentSaveRequest) => AgentSaveResult
  'agents:remove': (name: string) => boolean
  'memory:list': (projects: MemoryProject[]) => MemoryGroup[]
  'memory:read': (path: string, projects: MemoryProject[]) => string | null
  // base: o texto lido quando a edição começou; com ela, não grava por cima de mudança do disco.
  'memory:write': (path: string, text: string, projects: MemoryProject[], base?: string) => MemoryWriteResult
  // Canvas
  'canvasAgent:state': () => CanvasAgentState
  // Modo design
  'design:load': (id: string) => Design | null
  'design:list': (projectPath: string) => DesignSummary[]
  'design:save': (design: Design) => boolean
  'design:trash': (id: string) => boolean
  'design:snapshot': (origin: string) => string | null
  'design:routes': (projectPath: string) => DesignRoute[]
  // Sessões do Claude Code e git da pasta
  'sessions:list': (path: string) => SessionSummary[]
  'sessions:folders': () => KnownFolder[]
  'sessions:trash': (path: string, id: string) => string | null
  'sessions:branch': (path: string) => string | null
  'sessions:repoUrl': (path: string) => string | null
  'sessions:changes': (path: string) => UncommittedFile[] | null
  'sessions:history': (path: string, id: string) => Message[]
  'sessions:images': (path: string, id: string, messageId: string) => string[]
  'sessions:context': (path: string, id: string) => number
  // Servidores
  'devServers:list': (paths: string[]) => DevServer[]
  'devServers:kill': (pgid: number, paths: string[]) => boolean
  'projectServers:status': (paths: string[]) => Record<string, ProjectServer>
  'projectServers:start': (path: string, noBrowser?: boolean) => boolean
  'projectServers:stop': (path: string) => boolean
  // Arquivos
  'files:list': (root: string, rel: string) => FileEntry[]
  'files:read': (root: string, rel: string) => FileContent
  'files:diff': (root: string, rel: string) => FileDiff
  // base: o texto do disco na última leitura ou gravação; com ela, não grava por cima de mudança
  // feita por fora (responde conflict).
  'files:write': (root: string, rel: string, text: string, base?: string) => FileOpResult
  'files:create': (root: string, dir: string, name: string, isDir: boolean) => FileOpResult
  'files:rename': (root: string, rel: string, name: string) => FileOpResult
  'files:trash': (root: string, rel: string) => FileOpResult
  'files:copy': (root: string, rels: string[]) => void
  'files:paste': (root: string, dir: string) => FileOpResult
  // Terminais
  'terminal:open': (req: TerminalOpenRequest) => TerminalOpenResult
  // Conversa que o `claude` do terminal criou ou retomou, já gravada; nula se ainda não há.
  'terminal:session': (key: string) => string | null
}

// Mensagens sem resposta: ipcRenderer.send ↔ ipcMain.on.
export type SendChannels = {
  'theme:set': (theme: ThemeSource) => void
  'popout:open': (id: string, payload: unknown) => void
  'updates:install': () => void
  'cli:ready': () => void
  // Ditado
  'speech:start': () => void
  'speech:stop': () => void
  // Windows: o áudio do microfone, gravado pela janela (ver preload/winMic/).
  'speech:audio': (chunk: Uint8Array) => void
  'speech:openSettings': () => void
  // Contas
  'auth:refresh': () => void
  'auth:install': () => void
  'auth:login': (accountId: string, method: LoginMethod) => void
  'auth:add': (method: LoginMethod) => void
  'auth:code': (code: string) => void
  'auth:cancel': () => void
  'auth:rename': (accountId: string, name: string) => void
  'auth:setDefault': (accountId: string) => void
  'auth:open': (url: string) => void
  // Conversas
  'chat:send': (req: ChatSendRequest) => void
  'chat:remote-control': (req: ChatRemoteRequest) => void
  'chat:answer': (key: string, id: string, answer: PermissionAnswer) => void
  'chat:retain': (key: string) => void
  'chat:release': (key: string) => void
  'chat:interrupt': (key: string) => void
  'chat:configure': (key: string, patch: Partial<ChatSettings>) => void
  // Canvas
  'canvas:sync': (nodes: unknown) => void
  'canvas:record': () => void
  'canvas:undo': () => void
  'canvas:redo': () => void
  'canvas:setViewport': (viewport: CanvasViewport) => void
  'canvas:newWindow': () => void
  'canvasAgent:send': (text: string) => void
  'canvasAgent:interrupt': () => void
  'canvasAgent:result': (result: CanvasToolResult) => void
  // Modo design
  'design:escape': (origin: string, on: boolean) => void
  'design:track': (origin: string) => void
  'design:comment': (origin: string, action: DesignCommentAction, id?: number) => void
  // Sessões
  'sessions:openRepo': (path: string) => void
  'sessions:watch': (paths: string[]) => void
  // Arquivos
  'files:reveal': (root: string, rel: string) => void
  'files:watch': (root: string, rel: string) => void
  'files:unwatch': () => void
  // O painel de código desta janela tem (ou deixou de ter) arquivo com alteração não salva: fechar
  // ou atualizar o app pergunta antes.
  'files:unsaved': (has: boolean) => void
  // Terminais
  'terminal:write': (key: string, data: string) => void
  'terminal:resize': (key: string, cols: number, rows: number) => void
  'terminal:kill': (key: string) => void
}

// Síncronas, para o que a janela precisa antes do primeiro desenho: ipcRenderer.sendSync ↔
// ipcMain.on com returnValue.
export type SendSyncChannels = {
  'accent:get': () => string | null
  'canvas:load': () => unknown
  'canvas:viewport': () => CanvasViewport | null
}

// Avisos do processo principal para a janela: webContents.send ↔ ipcRenderer.on.
export type EventChannels = {
  edit: (action: EditAction) => void
  'reload-request': () => void
  'accent:changed': (color: string | null) => void
  'popout:closed': (id: string) => void
  'updates:state': (state: UpdateState) => void
  'usage:update': (account: string, usage: Usage | null) => void
  'claude:info': (account: string, info: ClaudeInfo) => void
  'cli:open': (path: string) => void
  'auth:state': (state: AuthState) => void
  'chat:state': (key: string, state: ChatState) => void
  // Clique na notificação do sistema.
  'chat:open': (cwd: string, sessionId: string) => void
  'canvas:remote': (nodes: unknown) => void
  'canvasAgent:state': (state: CanvasAgentState) => void
  'canvasAgent:call': (call: CanvasToolCall) => void
  // A ação `id` foi respondida no lugar da janela (parar, tempo esgotado): não executar mais.
  'canvasAgent:cancel': (id: string) => void
  'sessions:changed': (path: string, change: SessionChange) => void
  'files:changed': (root: string, rel: string) => void
  'terminal:data': (key: string, data: string) => void
  'terminal:exit': (key: string, code: number) => void
  // O `claude` do terminal `key` está na conversa `sessionId` (ver terminals/sessionBinding.ts).
  'terminal:session': (key: string, sessionId: string) => void
  'speech:event': (event: SpeechEvent) => void
  // Windows: o processo principal recebeu o start (ver preload/winMic/).
  'speech:started': () => void
  // Windows: o ditado começou em outra janela.
  'speech:micStop': () => void
}

type InvokeChannel = keyof InvokeChannels
type SendChannel = keyof SendChannels
type SendSyncChannel = keyof SendSyncChannels
type EventChannel = keyof EventChannels
