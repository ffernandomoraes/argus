import type { AgentDef, AgentProvider, AgentSaveRequest, AgentSaveResult } from './agents'
import type { AppSettings } from './appSettings'
import type { AuthState, LoginMethod } from './auth'
import type { ClipboardKey, ProviderId, ProvidersState } from './providers'
import type { Lang, LangPreference } from './i18n'
import type { CanvasViewport } from './canvas'
import type { CanvasAgentState, CanvasToolCall, CanvasToolResult } from './canvasAgent'
import type { ActiveChat, MascotAlerts, UnreadChat, ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, OutputStyleStatus, PermissionAnswer } from './chat'
import type { CliStatus } from './cli'
import type { Design, DesignSummary } from './design'
import type { DevServer, ProjectServer } from './devServers'
import type { FileContent, FileDiff, FileEntry, FileOpResult } from './files'
import type { HistoryPage, HistoryRequest, Message } from './history'
import type { ClipboardCommand, DesignCommentAction, DesignRoute, EditAction, ThemeSource } from './ipc'
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
  // Tamanho da interface desta janela (ver shared/interfaceZoom.ts).
  setInterfaceZoom: (factor: number) => void
  // Recortar, copiar ou colar no campo com o foco, como o ⌘X/⌘C/⌘V.
  clipboardCommand: (command: ClipboardCommand) => void
  // Cor de destaque do sistema, "#rrggbb"; nula quando o sistema não informa.
  accent: {
    get: () => string | null
    onChange: (cb: (color: string | null) => void) => Off
  }
  // Idioma da interface já resolvido; o aviso chega quando muda nos ajustes.
  language: {
    get: () => Lang
    onChange: (cb: () => void) => Off
  }
  // distro: abre na pasta do usuário no Linux daquela distro do WSL.
  pickFolder: (distro?: string) => Promise<string | null>
  pickFolders: (distro?: string) => Promise<string[]>
  // Pasta do workspace (nova, sem dir), com o aviso das pastas dele; devolve o caminho.
  syncWorkspace: (folders: string[], dir?: string) => Promise<string>
  wsl: {
    // Distros do WSL instaladas (só no Windows; vazio sem WSL).
    distros: () => Promise<string[]>
    // Texto com o que o app sabe do WSL e o que pediu a ele, para mandar quando algo não funciona.
    diagnostics: () => Promise<string>
  }
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
  // Transcrição de áudio anexado (Experimentos): o modelo é baixado só quando a pessoa aceita.
  transcription: {
    model: () => Promise<TranscriptionModel>
    download: () => void
    cancel: () => void
    onModel: (cb: (state: TranscriptionModel) => void) => Off
    // Texto do áudio já decodificado (mono, 16 kHz).
    transcribe: (samples: Float32Array) => Promise<string>
  }
  popout: {
    open: (id: string, payload: unknown) => void
    payload: (id: string) => Promise<unknown>
    onClosed: (cb: (id: string) => void) => Off
  }
  // Mascote solto na tela. As janelas do app avisam se está ligado e se alguém escreve; a janela
  // do mascote pega o clique só em cima do boneco e muda de lugar arrastando.
  mascot: {
    setEnabled: (on: boolean) => void
    setTyping: (typing: boolean) => void
    setInteractive: (on: boolean) => void
    dragTo: (x: number, y: number) => void
    dragEnd: () => void
    home: () => void
    reportTarget: (key: string, turn: number, rect: { x: number; y: number; width: number; height: number }) => void
    findTarget: (key: string, turn: number) => Promise<{ x: number; y: number } | null>
    walk: (x: number, y: number) => Promise<void>
    homeSpot: () => Promise<{ x: number; y: number }>
    alerts: () => Promise<MascotAlerts>
    onAlerts: (cb: (alerts: MascotAlerts) => void) => Off
    onTyping: (cb: (typing: boolean) => void) => Off
    onReleased: (cb: () => void) => Off
  }
  // Experimento do orquestrador ligado: as conversas abertas depois recebem a ferramenta delegate.
  orchestrator: {
    setEnabled: (on: boolean) => void
  }
  // Modelos e modo padrão que o `claude` de cada conta informa; sem conta, a padrão.
  claude: {
    info: (account?: string) => Promise<ClaudeInfo | null>
    onInfo: (cb: (account: string, info: ClaudeInfo) => void) => Off
  }
  // Qual `claude` o app usa, a versão dele e a publicada; update roda o `claude update`.
  claudeVersion: {
    get: () => Promise<ClaudeVersionState>
    check: () => Promise<ClaudeVersionState>
    update: () => Promise<ClaudeVersionState>
    onState: (cb: (state: ClaudeVersionState) => void) => Off
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
  // Contas dos outros agentes (Codex, Gemini, Cursor): instalação, login pelo navegador e chaves.
  providers: {
    state: () => Promise<ProvidersState>
    refresh: (provider?: ProviderId) => void
    install: (provider: ProviderId) => void
    // Conta nova: login pelo navegador ou a página da chave, conforme o agente.
    add: (provider: ProviderId) => void
    login: (provider: ProviderId, accountId: string) => void
    // Chave copiada esperando confirmação: só o final dela.
    clipboardKey: () => Promise<ClipboardKey>
    // Sem argumento: usa a da área de transferência, que não passa pela tela.
    submitKey: (key?: string) => void
    cancel: () => void
    remove: (provider: ProviderId, accountId: string) => void
    rename: (provider: ProviderId, accountId: string, name: string) => void
    setDefault: (provider: ProviderId, accountId: string) => void
    onState: (cb: (state: ProvidersState) => void) => Off
  }
  // Caminho no disco de um arquivo escolhido ou arrastado (anexos do chat).
  filePath: (file: File) => string
  // Aba MCP das configurações: os servidores de uma conta, sem conversa ('' é a principal). release:
  // a aba saiu da tela, o `claude` dela fecha.
  accountMcp: {
    status: (account: string, wait: boolean) => Promise<McpStatus>
    reconnect: (account: string, name: string) => Promise<McpStatus>
    authenticate: (account: string, name: string) => Promise<McpAuthResult>
    clearAuth: (account: string, name: string) => Promise<McpStatus>
    remove: (account: string, name: string, scope: string) => Promise<McpStatus>
    release: (account: string) => void
  }
  chat: {
    state: (key: string) => Promise<ChatState | null>
    send: (req: ChatSendRequest) => void
    remoteControl: (req: ChatRemoteRequest) => void
    answer: (key: string, id: string, answer: PermissionAnswer) => void
    interrupt: (key: string) => void
    retain: (key: string) => void
    mcpStatus: (key: string, cwd: string, account?: string) => Promise<McpStatus>
    mcpReconnect: (key: string, name: string) => Promise<McpStatus>
    mcpAuthenticate: (key: string, name: string) => Promise<McpAuthResult>
    mcpClearAuth: (key: string, name: string) => Promise<McpStatus>
    mcpRemove: (key: string, cwd: string, account: string | undefined, name: string, scope: string) => Promise<McpStatus>
    outputStyle: (key: string, cwd: string, account?: string) => Promise<OutputStyleStatus>
    setOutputStyle: (key: string, cwd: string, style: string) => Promise<OutputStyleStatus>
    release: (key: string) => void
    restartIn: (cwd: string) => void
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
  // Biblioteca de agentes de cada provedor (main/agents/folder.ts). Com a pasta, inclui os do projeto.
  agents: {
    list: (provider: AgentProvider, projectPath?: string) => Promise<AgentDef[]>
    save: (provider: AgentProvider, req: AgentSaveRequest) => Promise<AgentSaveResult>
    remove: (provider: AgentProvider, name: string) => Promise<boolean>
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
    // Blocos que saíram de vez: somem também do histórico (nenhum desfazer os traz de volta).
    forget: (ids: string[]) => void
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
    // Conversas da pasta; nulo se ela não respondeu ou não deu para ler (o WSL parado ou travado):
    // não é o mesmo que não ter conversa nenhuma.
    list: (path: string) => Promise<SessionSummary[] | null>
    // Pastas onde o Claude Code já conversou, da mais recente para a mais antiga.
    folders: () => Promise<KnownFolder[]>
    // Conversas da pasta que falam do termo (sem acento nem maiúscula), com um trecho em volta.
    search: (path: string, query: string) => Promise<SearchHit[]>
    // Move a conversa para a Lixeira; devolve o erro ou nulo.
    trash: (path: string, id: string) => Promise<string | null>
    // Branch atual do git da pasta; nulo fora de repositório. O aviso onChanged cobre a troca.
    branch: (path: string) => Promise<string | null>
    // Branches locais e só do remoto, para o seletor acima da pasta; nulo fora de repositório.
    branches: (path: string) => Promise<BranchList | null>
    // git fetch do remoto; devolve se deu certo (sem rede ou pedindo senha, não).
    fetch: (path: string) => Promise<boolean>
    // Troca de branch (ou cria uma nova com `create`); devolve o erro ou nulo. Com arquivos não
    // comitados, a troca é recusada.
    checkout: (path: string, option: BranchOption, create?: boolean) => Promise<string | null>
    // Página do repositório no GitHub (ou outro host) a partir do remoto; nulo sem remoto.
    repoUrl: (path: string) => Promise<string | null>
    // Abre essa página no navegador.
    openRepo: (path: string) => void
    // Arquivos não comitados do repositório da pasta; nulo fora de repositório.
    changes: (path: string) => Promise<UncommittedFile[] | null>
    history: (path: string, id: string) => Promise<Message[]>
    // O trecho do fim que a conversa mostra (ver HistoryRequest em shared/history).
    historyPage: (path: string, id: string, request: HistoryRequest) => Promise<HistoryPage>
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
  // Tarefa isolada num git worktree (ver shared/worktrees.ts).
  worktrees: {
    // Reserva a pasta da tarefa a partir da pasta do card (sai da branch atual dela); o worktree
    // nasce no primeiro envio da conversa. Devolve a pasta do card filho.
    reserve: (folder: string) => Promise<WorktreeReserved>
    // Worktree em que o próprio Claude levou a conversa (EnterWorktree): passa a ser acompanhado
    // como os do Argus. `from`: a pasta de onde a conversa saiu.
    adopt: (path: string, from: string) => Promise<WorktreeReserved>
    // Situação (preparando, erro), apps tocados, arquivos alterados e commits não enviados; nulo se
    // não é um worktree do Argus.
    status: (path: string) => Promise<WorktreeStatus | null>
    // Apaga a pasta (a branch fica); devolve o erro ou nulo.
    remove: (path: string) => Promise<string | null>
  }
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
    // Caminho absoluto de um link do chat; acha o arquivo mesmo com o começo do caminho cortado.
    locate: (root: string, rel: string) => Promise<string | null>
    // Imagem em qualquer caminho (data URL), para o preview do que o Claude leu; null se não der.
    image: (path: string) => Promise<string | null>
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
    // Abre a própria pasta no Finder ou no Explorador de Arquivos.
    openFolder: (path: string) => void
    // Abre no visualizador do sistema: Quick Look no Mac, app padrão no Windows e no Linux.
    view: (root: string, rel: string) => void
    openInBrowser: (root: string, rel: string) => void
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
    // A saída do terminal `key` (só a dele).
    onData: (key: string, cb: (data: string) => void) => Off
    onExit: (cb: (key: string, code: number) => void) => Off
    // Conversa do `claude` do terminal, amarrada pelo processo dele (sem adivinhar pela pasta).
    session: (key: string) => Promise<string | null>
    onSession: (cb: (key: string, sessionId: string) => void) => Off
    // Shell do drawer: a conversa de cima pode digitar nele enquanto está à vista.
    link: (key: string, conversations: string[]) => void
    unlink: (key: string) => void
    // A conversa digitou no terminal `key`.
    onTyped: (key: string, cb: () => void) => Off
    // A conversa quer digitar no terminal e ele está fechado: o drawer dela abre.
    onOpenFor: (cb: (conversations: string[]) => void) => Off
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
    setLanguage: (pref: LangPreference) => Promise<AppSettings>
  }
  // Atualização do app pelos releases do GitHub.
  updates: {
    get: () => Promise<UpdateInfo>
    check: () => Promise<UpdateState>
    // Notas das últimas versões, direto do GitHub.
    notes: () => Promise<ReleaseNote[]>
    install: () => void
    onState: (cb: (state: UpdateState) => void) => Off
  }
  // Limites de cada conta logada; nulo quando a conta sai ou é removida.
  usage: {
    get: () => Promise<Record<string, Usage>>
    onUpdate: (cb: (account: string, usage: Usage | null) => void) => Off
  }
  // O que toca no sistema; nulo sem nada tocando ou sem como ler.
  media: {
    get: () => Promise<NowPlaying | null>
    command: (command: MediaCommand) => Promise<void>
    setVolume: (volume: number) => Promise<void>
  }
}
