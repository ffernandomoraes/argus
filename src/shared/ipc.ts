import type { AgentDef, AgentProvider, AgentSaveRequest, AgentSaveResult } from './agents'
import type { AppSettings } from './appSettings'
import type { Lang, LangPreference } from './i18n'
import type { AuthState, LoginMethod } from './auth'
import type { ClipboardKey, ProviderId, ProvidersState } from './providers'
import type { CanvasViewport } from './canvas'
import type { CanvasAgentState, CanvasToolCall, CanvasToolResult } from './canvasAgent'
import type { ActiveChat, MascotAlerts, UnreadChat, ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, OutputStyleStatus, PermissionAnswer } from './chat'
import type { CliStatus } from './cli'
import type { Design, DesignSummary } from './design'
import type { DevServer, ProjectServer } from './devServers'
import type { FileContent, FileDiff, FileEntry, FileOpResult } from './files'
import type { HistoryPage, HistoryRequest, Message } from './history'
import type { McpAuthResult, McpStatus } from './mcp'
import type { MediaCommand, NowPlaying } from './media'
import type { MemoryGroup, MemoryProject, MemoryWriteResult } from './memory'
import type { ClaudeVersionState } from './claudeVersion'
import type { ClaudeInfo } from './models'
import type { BranchList, BranchOption, KnownFolder, SearchHit, SessionChange, SessionSummary, UncommittedFile } from './sessions'
import type { SpeechEvent } from './speech'
import type { TerminalOpenRequest, TerminalOpenResult } from './terminal'
import type { TranscriptionModel } from './transcription'
import type { ReleaseNote, UpdateInfo, UpdateState } from './updates'
import type { Usage } from './usage'
import type { WorktreeReserved, WorktreeStatus } from './worktrees'

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
  // distro: abre na pasta do usuário no Linux daquela distro do WSL.
  'dialog:pickFolder': (distro?: string) => string | null
  // Várias pastas de uma vez (workspace); cancelado: vazio.
  'dialog:pickFolders': (distro?: string) => string[]
  // Workspace: cria (sem dir) ou atualiza a pasta dele (src/main/workspaces.ts); devolve o caminho.
  'workspace:sync': (folders: string[], dir?: string) => string
  // Distros do WSL instaladas (só no Windows; vazio sem WSL).
  'wsl:distros': () => string[]
  // Texto para copiar e mandar quando algo do WSL não funciona.
  'wsl:diagnostics': () => string
  'settings:get': () => AppSettings
  'settings:menuBarIcon': (on: boolean) => AppSettings
  'settings:language': (pref: LangPreference) => AppSettings
  'updates:get': () => UpdateInfo
  'updates:check': () => UpdateState
  'updates:notes': () => ReleaseNote[]
  'popout:payload': (id: string) => unknown
  // Respostas não vistas e conversas que pararam com erro (o check verde e o aviso do mascote).
  'mascot:alerts': () => MascotAlerts
  'usage:get': () => Record<string, Usage>
  'media:get': () => NowPlaying | null
  'media:command': (command: MediaCommand) => void
  'media:volume': (volume: number) => void
  'claude:info': (account?: string) => ClaudeInfo | null
  'claudeVersion:get': () => ClaudeVersionState
  'claudeVersion:check': () => ClaudeVersionState
  'claudeVersion:update': () => ClaudeVersionState
  'cli:status': () => CliStatus
  'cli:install': () => CliStatus
  'cli:uninstall': () => CliStatus
  // Contas
  'auth:state': () => AuthState
  'auth:logout': () => boolean
  'auth:remove': (accountId: string) => boolean
  // Contas dos outros agentes (Codex, Gemini, Cursor)
  'providers:state': () => ProvidersState
  'providers:clipboardKey': () => ClipboardKey
  // Conversas
  'chat:state': (key: string) => ChatState | null
  'chat:active': () => ActiveChat[]
  'mcp:status': (key: string, cwd: string, account?: string) => McpStatus
  'chat:outputStyle': (key: string, cwd: string, account?: string) => OutputStyleStatus
  'chat:setOutputStyle': (key: string, cwd: string, style: string) => OutputStyleStatus
  'mcp:reconnect': (key: string, name: string) => McpStatus
  'mcp:authenticate': (key: string, name: string) => McpAuthResult
  'mcp:clearAuth': (key: string, name: string) => McpStatus
  'mcp:remove': (key: string, cwd: string, account: string | undefined, name: string, scope: string) => McpStatus
  // Aba MCP das configurações: os servidores de uma conta, sem conversa ('' é a principal).
  'mcp:account:status': (account: string, wait: boolean) => McpStatus
  'mcp:account:reconnect': (account: string, name: string) => McpStatus
  'mcp:account:authenticate': (account: string, name: string) => McpAuthResult
  'mcp:account:clearAuth': (account: string, name: string) => McpStatus
  'mcp:account:remove': (account: string, name: string, scope: string) => McpStatus
  'agents:list': (provider: AgentProvider, projectPath?: string) => AgentDef[]
  'agents:save': (provider: AgentProvider, req: AgentSaveRequest) => AgentSaveResult
  'agents:remove': (provider: AgentProvider, name: string) => boolean
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
  'sessions:search': (path: string, query: string) => SearchHit[]
  'sessions:trash': (path: string, id: string) => string | null
  'sessions:branch': (path: string) => string | null
  'sessions:branches': (path: string) => BranchList | null
  'sessions:fetch': (path: string) => boolean
  'sessions:checkout': (path: string, option: BranchOption, create?: boolean) => string | null
  'sessions:repoUrl': (path: string) => string | null
  'sessions:changes': (path: string) => UncommittedFile[] | null
  'sessions:history': (path: string, id: string) => Message[]
  'sessions:historyPage': (path: string, id: string, request: HistoryRequest) => HistoryPage
  'sessions:images': (path: string, id: string, messageId: string) => string[]
  'sessions:context': (path: string, id: string) => number
  // Worktrees criados pelo Argus (ver shared/worktrees.ts)
  'worktrees:reserve': (folder: string) => WorktreeReserved
  'worktrees:status': (path: string) => WorktreeStatus | null
  'worktrees:remove': (path: string) => string | null
  // Servidores
  'devServers:list': (paths: string[]) => DevServer[]
  'devServers:kill': (pgid: number, paths: string[]) => boolean
  'projectServers:status': (paths: string[]) => Record<string, ProjectServer>
  'projectServers:start': (path: string, noBrowser?: boolean) => boolean
  'projectServers:stop': (path: string) => boolean
  // Arquivos
  'files:list': (root: string, rel: string) => FileEntry[]
  'files:read': (root: string, rel: string) => FileContent
  'files:locate': (root: string, rel: string) => string | null
  'files:image': (path: string) => string | null
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
  // Transcrição de áudio anexado: situação do modelo e o texto de um áudio (mono, 16 kHz).
  'transcription:model': () => TranscriptionModel
  'transcription:transcribe': (samples: Float32Array) => string
}

// Mensagens sem resposta: ipcRenderer.send ↔ ipcMain.on.
export type SendChannels = {
  'theme:set': (theme: ThemeSource) => void
  'interface:zoom': (factor: number) => void
  'popout:open': (id: string, payload: unknown) => void
  // Mascote solto na tela (src/main/app/mascotOverlay.ts). Das janelas do app: ligado nas
  // Configurações e alguém escrevendo um pedido. Da janela do mascote: o ponteiro em cima do boneco
  // (pega o clique), arrastar (o canto de cima da janela em coordenadas da tela), soltar e voltar
  // ao canto (dois cliques).
  'mascot:enabled': (on: boolean) => void
  'mascot:typing': (typing: boolean) => void
  'mascot:interactive': (on: boolean) => void
  'mascot:drag': (x: number, y: number) => void
  'mascot:dragEnd': () => void
  'mascot:home': () => void
  'updates:install': () => void
  'cli:ready': () => void
  // Ditado
  'speech:start': () => void
  'speech:stop': () => void
  // Windows: o áudio do microfone, gravado pela janela (ver preload/winMic/).
  'speech:audio': (chunk: Uint8Array) => void
  'speech:openSettings': () => void
  // Download do modelo de transcrição (só depois de a pessoa aceitar).
  'transcription:download': () => void
  'transcription:cancel': () => void
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
  'providers:refresh': (provider?: ProviderId) => void
  'providers:install': (provider: ProviderId) => void
  'providers:add': (provider: ProviderId) => void
  'providers:login': (provider: ProviderId, accountId: string) => void
  'providers:submitKey': (key?: string) => void
  'providers:cancel': () => void
  'providers:remove': (provider: ProviderId, accountId: string) => void
  'providers:rename': (provider: ProviderId, accountId: string, name: string) => void
  'providers:setDefault': (provider: ProviderId, accountId: string) => void
  // Conversas
  'chat:send': (req: ChatSendRequest) => void
  'chat:remote-control': (req: ChatRemoteRequest) => void
  'chat:answer': (key: string, id: string, answer: PermissionAnswer) => void
  'chat:retain': (key: string) => void
  'chat:release': (key: string) => void
  'mcp:account:release': (account: string) => void
  // Workspace mudou de pastas: as sessões abertas na pasta dele reabrem com a lista nova.
  'chat:restartIn': (cwd: string) => void
  // Conversas com resposta não vista nesta janela (para o ícone da barra de menus).
  'chat:unread': (chats: UnreadChat[]) => void
  'chat:interrupt': (key: string) => void
  'chat:configure': (key: string, patch: Partial<ChatSettings>) => void
  // Canvas
  'canvas:sync': (nodes: unknown) => void
  'canvas:record': () => void
  'canvas:undo': () => void
  'canvas:forget': (ids: string[]) => void
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
  'files:openFolder': (path: string) => void
  'files:view': (root: string, rel: string) => void
  'files:openInBrowser': (root: string, rel: string) => void
  'files:watch': (root: string, rel: string) => void
  'files:unwatch': () => void
  // O painel de código desta janela tem (ou deixou de ter) arquivo com alteração não salva: fechar
  // ou atualizar o app pergunta antes.
  'files:unsaved': (has: boolean) => void
  // Terminais
  'terminal:write': (key: string, data: string) => void
  'terminal:resize': (key: string, cols: number, rows: number) => void
  'terminal:kill': (key: string) => void
  // Shell do drawer à vista embaixo das conversas `conversations` (o id no app e o da sessão).
  'terminal:link': (key: string, conversations: string[]) => void
  'terminal:unlink': (key: string) => void
}

// Síncronas, para o que a janela precisa antes do primeiro desenho: ipcRenderer.sendSync ↔
// ipcMain.on com returnValue.
export type SendSyncChannels = {
  'accent:get': () => string | null
  // Idioma da interface já resolvido (o do sistema, quando o ajuste é "system").
  'language:get': () => Lang
  'canvas:load': () => unknown
  'canvas:viewport': () => CanvasViewport | null
}

// Avisos do processo principal para a janela: webContents.send ↔ ipcRenderer.on.
export type EventChannels = {
  edit: (action: EditAction) => void
  // Para a janela do mascote: alguém escrevendo um pedido no app; respostas não vistas e erros.
  'mascot:typing': (typing: boolean) => void
  'mascot:alerts': (alerts: MascotAlerts) => void
  // O ponteiro saiu do boneco e o clique voltou a atravessar a janela dele.
  'mascot:released': () => void
  'reload-request': () => void
  'accent:changed': (color: string | null) => void
  // Idioma trocado nos ajustes: a janela recarrega para redesenhar os textos.
  'language:changed': () => void
  'popout:closed': (id: string) => void
  'updates:state': (state: UpdateState) => void
  'usage:update': (account: string, usage: Usage | null) => void
  'claude:info': (account: string, info: ClaudeInfo) => void
  'claudeVersion:state': (state: ClaudeVersionState) => void
  'cli:open': (path: string) => void
  'auth:state': (state: AuthState) => void
  'providers:state': (state: ProvidersState) => void
  'chat:state': (key: string, state: ChatState) => void
  // As conversas trabalhando ou esperando você mudaram.
  'chat:active': (chats: ActiveChat[]) => void
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
  // A conversa digitou um comando no shell do drawer `key`: ele pega o foco, para o Enter.
  'terminal:typed': (key: string) => void
  // A conversa quer digitar no terminal: o drawer que mostra uma destas conversas abre o dele.
  'terminal:openFor': (conversations: string[]) => void
  'speech:event': (event: SpeechEvent) => void
  // Windows: o processo principal recebeu o start (ver preload/winMic/).
  'speech:started': () => void
  // Windows: o ditado começou em outra janela.
  'speech:micStop': () => void
  // Situação do modelo de transcrição mudou (download andando, pronto, erro).
  'transcription:model': (state: TranscriptionModel) => void
}

type InvokeChannel = keyof InvokeChannels
type SendChannel = keyof SendChannels
type SendSyncChannel = keyof SendSyncChannels
type EventChannel = keyof EventChannels
