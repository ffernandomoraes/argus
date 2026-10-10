import type { AgentDef, AgentSaveRequest, AgentSaveResult } from './agents'
import type { AppSettings } from './appSettings'
import type { AuthState, LoginMethod } from './auth'
import type { CanvasViewport } from './canvas'
import type { CanvasAgentState, CanvasToolCall, CanvasToolResult } from './canvasAgent'
import type { ActiveChat, UnreadChat, ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from './chat'
import type { CliStatus } from './cli'
import type { Design, DesignSummary } from './design'
import type { DevServer, ProjectServer } from './devServers'
import type { FileContent, FileDiff, FileEntry, FileOpResult } from './files'
import type { Message } from './history'
import type { DesignCommentAction, DesignRoute, EditAction, ThemeSource } from './ipc'
import type { McpStatus } from './mcp'
import type { MemoryGroup, MemoryProject, MemoryWriteResult } from './memory'
import type { ClaudeInfo } from './models'
import type { KnownFolder, SessionChange, SessionSummary, UncommittedFile } from './sessions'
import type { SpeechEvent } from './speech'
import type { TerminalOpenRequest, TerminalOpenResult } from './terminal'
import type { UpdateInfo, UpdateState } from './updates'
import type { Usage } from './usage'

// Formato de `window.api`, a ponte entre a interface e o processo principal. Escrito só aqui: o
// preload implementa (`const api: Api`) e a interface usa (preload/index.d.ts). Os `on...` devolvem
// a função que para de escutar.
type Off = () => void

export type Api = {
  platform: string
  homeDir: string
  // Windows: número do build do sistema (o terceiro de "10.0.22631"), para o terminal saber como o
  // ConPTY redesenha; nulo no Mac ou se o sistema não informar.
  windowsBuild: number | null
  setTheme: (theme: ThemeSource) => void
  // Cor de destaque do sistema, "#rrggbb"; nula quando o sistema não informa.
  accent: {
    get: () => string | null
    onChange: (cb: (color: string | null) => void) => Off
  }
  pickFolder: () => Promise<string | null>
  onEdit: (cb: (action: EditAction) => void) => Off
  // ⌘R / Ctrl+R: quem escuta (o último) recarrega o que é seu em vez da janela inteira.
  onReloadKey: (cb: () => void) => Off
  // No Windows o microfone é gravado pela janela (preload/winMic/); no Mac, pelo programa native/speech.
  speech: {
    start: () => void
    stop: () => void
    openSettings: () => void
    onEvent: (cb: (event: SpeechEvent) => void) => Off
  }
  popout: {
    open: (id: string, payload: unknown) => void
    payload: (id: string) => Promise<unknown>
    onClosed: (cb: (id: string) => void) => Off
  }
  // Modelos e modo padrão que o `claude` de cada conta informa; sem conta, a padrão.
  claude: {
    info: (account?: string) => Promise<ClaudeInfo | null>
    onInfo: (cb: (account: string, info: ClaudeInfo) => void) => Off
  }
  // Contas do Claude Code: a principal (a mesma do terminal e do VS Code) e as que têm pasta própria.
  auth: {
    state: () => Promise<AuthState>
    // Confere de novo o login de todas as contas (um login feito no terminal, por exemplo).
    refresh: () => void
    // Claude Code não achado: roda o instalador oficial (o andamento chega em state.claude).
    install: () => void
    // Entra de novo numa conta da lista (ou em outra no lugar dela).
    login: (accountId: string, method: LoginMethod) => void
    // Conta nova; entra na lista quando o login termina.
    add: (method: LoginMethod) => void
    submitCode: (code: string) => void
    cancel: () => void
    // Sai da principal, inclusive no terminal e no VS Code.
    logout: () => Promise<boolean>
    // Tira uma conta que não é a principal: sai dela e apaga a pasta.
    remove: (accountId: string) => Promise<boolean>
    // Apelido vazio volta para o nome sugerido.
    rename: (accountId: string, name: string) => void
    setDefault: (accountId: string) => void
    open: (url: string) => void
    onState: (cb: (state: AuthState) => void) => Off
  }
  // Caminho no disco de um arquivo escolhido ou arrastado (anexos do chat).
  filePath: (file: File) => string
  chat: {
    state: (key: string) => Promise<ChatState | null>
    send: (req: ChatSendRequest) => void
    remoteControl: (req: ChatRemoteRequest) => void
    answer: (key: string, id: string, answer: PermissionAnswer) => void
    interrupt: (key: string) => void
    retain: (key: string) => void
    mcpStatus: (key: string, cwd: string, account?: string) => Promise<McpStatus>
    release: (key: string) => void
    configure: (key: string, patch: Partial<ChatSettings>) => void
    onState: (cb: (key: string, state: ChatState) => void) => Off
    // Clique na notificação do sistema.
    onOpen: (cb: (cwd: string, sessionId: string) => void) => Off
    // Conversas trabalhando ou esperando você, em todas as pastas.
    active: () => Promise<ActiveChat[]>
    onActive: (cb: (chats: ActiveChat[]) => void) => Off
    // Respostas não vistas nesta janela: o ícone da barra de menus conta e lista.
    setUnread: (chats: UnreadChat[]) => void
  }
  // Biblioteca de agentes (~/.claude/agents). Com a pasta, inclui os do projeto.
  agents: {
    list: (projectPath?: string) => Promise<AgentDef[]>
    save: (req: AgentSaveRequest) => Promise<AgentSaveResult>
    remove: (name: string) => Promise<boolean>
  }
  memory: {
    list: (projects: MemoryProject[]) => Promise<MemoryGroup[]>
    read: (path: string, projects: MemoryProject[]) => Promise<string | null>
    // base: o texto lido quando a edição começou; com ela, um arquivo que mudou no disco desde
    // então não é sobrescrito (responde 'conflict').
    write: (path: string, text: string, projects: MemoryProject[], base?: string) => Promise<MemoryWriteResult>
  }
  canvas: {
    // Síncrono: o canvas já abre com o que estava salvo, sem piscar vazio.
    load: () => unknown
    // O canvas é um só em todas as janelas: a mudança feita aqui vai para as outras (e para o arquivo).
    sync: (nodes: unknown) => void
    onRemote: (cb: (nodes: unknown) => void) => Off
    // Desfazer é um só para todas as janelas: o histórico fica no processo principal.
    record: () => void
    undo: () => void
    redo: () => void
    // Câmera desta janela, para ela reabrir olhando o mesmo lugar.
    viewport: () => CanvasViewport | null
    setViewport: (viewport: CanvasViewport) => void
    newWindow: () => void
  }
  canvasAgent: {
    state: () => Promise<CanvasAgentState>
    send: (text: string) => void
    interrupt: () => void
    onState: (cb: (state: CanvasAgentState) => void) => Off
    // Ações que o Claude pede; a resposta volta por respond.
    onCall: (cb: (call: CanvasToolCall) => void) => Off
    respond: (result: CanvasToolResult) => void
    // A ação foi respondida no lugar da janela ("parar", tempo esgotado): o que ela ainda fizer
    // (um seletor de pasta que continuou aberto) não deve entrar no canvas.
    onCancel: (cb: (id: string) => void) => Off
  }
  // Modo design: protótipos guardados em ~/.argus/design (o código fica no projeto).
  design: {
    load: (id: string) => Promise<Design | null>
    // Grava o design.json; falso se não deu.
    save: (design: Design) => Promise<boolean>
    // Designs da pasta, para a lista de conversas dela.
    list: (projectPath: string) => Promise<DesignSummary[]>
    // Pasta do design para a Lixeira.
    trash: (id: string) => Promise<boolean>
    // Visualizar: o Esc dentro da página do protótipo chega ao drawer (mensagem 'escape').
    escape: (origin: string, on: boolean) => void
    // A página do protótipo passa a avisar o endereço a cada navegação (mensagem 'location').
    track: (origin: string) => void
    // Retrato da tela em texto (título, modais, avisos, campos, botões à vista); nulo se não deu.
    snapshot: (origin: string) => Promise<string | null>
    // Comentários na página: liga ou desliga o clique que marca o ponto, tira um ponto ou todos.
    comment: (origin: string, action: DesignCommentAction, id?: number) => void
    // Rotas do projeto lidas do código (pastas de páginas, rotas escritas), para a lista do endereço.
    routes: (projectPath: string) => Promise<DesignRoute[]>
  }
  sessions: {
    list: (path: string) => Promise<SessionSummary[]>
    // Pastas onde o Claude Code já conversou, da mais recente para a mais antiga.
    folders: () => Promise<KnownFolder[]>
    // Move a conversa para a Lixeira; devolve o erro ou nulo.
    trash: (path: string, id: string) => Promise<string | null>
    // Branch atual do git da pasta; nulo fora de repositório. O aviso onChanged cobre a troca.
    branch: (path: string) => Promise<string | null>
    // Página do repositório no GitHub (ou outro host) a partir do remoto; nulo sem remoto.
    repoUrl: (path: string) => Promise<string | null>
    // Abre essa página no navegador.
    openRepo: (path: string) => void
    // Arquivos não comitados do repositório da pasta; nulo fora de repositório.
    changes: (path: string) => Promise<UncommittedFile[] | null>
    history: (path: string, id: string) => Promise<Message[]>
    // Imagens de uma mensagem sua (data URLs), lidas só quando o preview abre.
    images: (path: string, id: string, messageId: string) => Promise<string[]>
    // Porcentagem da janela de contexto que a conversa ocupa agora.
    context: (path: string, id: string) => Promise<number>
    // Pastas desta janela que o processo principal vigia (avisa em onChanged).
    watch: (paths: string[]) => void
    // change: o que mudou (conversa, status ou git), para reler só o necessário.
    onChanged: (cb: (path: string, change: SessionChange) => void) => Off
  }
  // Servidores locais: os que o Claude Code ou o play deixaram rodando e qualquer porta aberta
  // dentro das pastas do canvas (`paths`).
  devServers: {
    list: (paths: string[]) => Promise<DevServer[]>
    kill: (pgid: number, paths: string[]) => Promise<boolean>
  }
  // Servidor de cada pasta do canvas: rodando (venha de onde vier) e iniciar/encerrar.
  projectServers: {
    status: (paths: string[]) => Promise<Record<string, ProjectServer>>
    // noBrowser: o servidor não abre o navegador sozinho (BROWSER=none), como no modo design.
    start: (path: string, noBrowser?: boolean) => Promise<boolean>
    stop: (path: string) => Promise<boolean>
  }
  files: {
    list: (root: string, rel: string) => Promise<FileEntry[]>
    read: (root: string, rel: string) => Promise<FileContent>
    // Mudanças do arquivo desde o último commit.
    diff: (root: string, rel: string) => Promise<FileDiff>
    // base: o texto do disco na última leitura ou gravação; com ela, um arquivo mudado por fora
    // não é sobrescrito (responde ok: false com conflict).
    write: (root: string, rel: string, text: string, base?: string) => Promise<FileOpResult>
    // `name` pode ter subpastas ("src/novo.ts"); as que faltarem são criadas.
    create: (root: string, dir: string, name: string, isDir: boolean) => Promise<FileOpResult>
    rename: (root: string, rel: string, name: string) => Promise<FileOpResult>
    // Manda para a Lixeira.
    trash: (root: string, rel: string) => Promise<FileOpResult>
    // Copia os itens para a área de transferência, como o ⌘C do Finder.
    copy: (root: string, rels: string[]) => Promise<void>
    // Cola na pasta os arquivos copiados no Finder (ou na árvore).
    paste: (root: string, dir: string) => Promise<FileOpResult>
    reveal: (root: string, rel: string) => void
    watch: (root: string, rel: string) => void
    unwatch: () => void
    onChanged: (cb: (root: string, rel: string) => void) => Off
    // Há (ou não) arquivo com alteração não salva no painel de código desta janela.
    setUnsaved: (has: boolean) => void
  }
  // A saída de um terminal chega só às janelas que pediram para abri-lo (open).
  terminal: {
    open: (req: TerminalOpenRequest) => Promise<TerminalOpenResult>
    write: (key: string, data: string) => void
    resize: (key: string, cols: number, rows: number) => void
    kill: (key: string) => void
    onData: (cb: (key: string, data: string) => void) => Off
    onExit: (cb: (key: string, code: number) => void) => Off
    // Conversa do `claude` do terminal, amarrada pelo processo dele (sem adivinhar pela pasta).
    session: (key: string) => Promise<string | null>
    onSession: (cb: (key: string, sessionId: string) => void) => Off
  }
  // Comando `argus` do terminal.
  cli: {
    ready: () => void
    onOpen: (cb: (path: string) => void) => Off
    status: () => Promise<CliStatus>
    install: () => Promise<CliStatus>
    uninstall: () => Promise<CliStatus>
  }
  // Preferências guardadas no processo principal.
  settings: {
    get: () => Promise<AppSettings>
    setMenuBarIcon: (on: boolean) => Promise<AppSettings>
  }
  // Atualização do app pelos releases do GitHub.
  updates: {
    get: () => Promise<UpdateInfo>
    check: () => Promise<UpdateState>
    install: () => void
    onState: (cb: (state: UpdateState) => void) => Off
  }
  // Limites de cada conta logada; nulo quando a conta sai ou é removida.
  usage: {
    get: () => Promise<Record<string, Usage>>
    onUpdate: (cb: (account: string, usage: Usage | null) => void) => Off
  }
}
