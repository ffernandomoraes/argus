import type { RunningAgent } from './agents'
import type { AttachedFile } from './attachedFiles'
import type { DiffHunk, LiveStatus } from './history'
import type { BackgroundTaskInfo } from './backgroundTasks'

// Pedido de permissão do Claude (editar, rodar comando...) esperando resposta no chat.
export type PermissionRequest = {
  id: string
  toolName: string
  // Nome amigável da ferramenta e a intenção da chamada.
  label: string
  summary: string
  // Frase pronta do Claude Code, quando ele manda ("Claude wants to read foo.txt").
  title?: string
  // Comando, caminho ou endereço completo que a ferramenta vai usar.
  detail?: string
  // Existe regra para não perguntar de novo nesta sessão.
  canAlwaysAllow: boolean
  // Edição proposta, para ver antes de permitir.
  diff?: DiffHunk[]
  // Perguntas com opções (ferramenta AskUserQuestion), respondidas no próprio chat.
  questions?: Question[]
}

export type Question = {
  question: string
  header: string
  multiSelect: boolean
  options: { label: string; description: string }[]
}

// Respostas das perguntas: texto da pergunta → opção escolhida (várias, separadas por vírgula).
export type PermissionAnswer = 'allow' | 'always' | 'deny' | { answers: Record<string, string> }

// Estado da conversa ligada ao Claude pelo chat. O histórico em si vem do arquivo da sessão.
export type ChatState = {
  status: LiveStatus
  // Id da sessão do Claude Code; chega logo após o primeiro envio numa conversa nova.
  sessionId?: string
  // Resposta sendo escrita agora, antes de ser gravada no arquivo.
  partial: string
  permissions: PermissionRequest[]
  error?: string
  // Sobe quando a sessão grava algo: o chat relê o histórico.
  revision: number
  // Pedido em andamento: quando começou (ms) e quantos tokens o Claude já gerou nele.
  turnStartedAt?: number
  turnTokens: number
  // Etapa do pedido em andamento, para o rótulo "Pensando…", "Executando…" etc.
  activity?: ChatActivity
  // A API falhou e o Claude Code vai tentar de novo; sai quando a resposta começa.
  retry?: ChatRetry
  // Compactando a conversa desde (ms).
  compactingSince?: number
  // Remote control ligado: a conversa também pode ser continuada pelo claude.ai ou pelo celular.
  remote?: RemoteControl
  // Subagentes trabalhando agora, lançados por esta conversa.
  agents: RunningAgent[]
  // Comandos, monitores e workflows que o Claude deixou rodando em segundo plano (subagentes
  // ficam em agents). Enquanto houver algum, a sessão não fecha: fechar mataria os processos.
  backgroundTasks: number
  // Quando cada uma delas apareceu (id da tarefa → ms), para mostrar há quanto tempo rodam.
  backgroundStarts?: Record<string, number>
  // O que se sabe de cada uma (id da tarefa → descrição, tipo e arquivo da saída), para o drawer que
  // mostra a saída.
  backgroundInfo?: Record<string, BackgroundTaskInfo>
  // Mensagens suas na fila do Claude, ainda fora do histórico (ele só grava o texto ao entregar).
  queued?: QueuedMessage[]
  // Conversa com outro agente: agente e conta ("codex:main"). Sem ele: Claude.
  agent?: string
  // Próxima mensagem que o Claude Code prevê que você mandaria, ao fim do pedido: vira um balão
  // clicável em cima da caixa de escrever. Sai quando começa outro pedido.
  suggestion?: string
  // O Claude entrou num git worktree ou saiu dele (ferramentas EnterWorktree e ExitWorktree).
  worktree?: ChatWorktree
  // Pedido aberto pelo próprio Claude Code para entregar o aviso de uma tarefa em segundo plano que
  // terminou, sem mensagem sua: o fim dele não vira notificação. Sai com a sua próxima mensagem.
  wake?: boolean
}

// O Claude Code leva o arquivo da conversa para a pasta de conversas do worktree ao entrar, e de
// volta ao sair: a tela acompanha, com a conversa no card filho do worktree, embaixo da pasta.
// path: o worktree; from: a pasta de onde a conversa saiu; left: o Claude saiu dele, mantendo
// ('keep') ou apagando ('remove') a pasta. Caminhos como o Argus enxerga (no WSL, \\wsl.localhost\...).
export type ChatWorktree = { path: string; from: string; branch?: string; left?: 'keep' | 'remove' }

// Mensagem enviada com o Claude no meio de um pedido. at: hora do envio (ms).
export type QueuedMessage = { id: string; text: string; at: number }

// Conversa do app trabalhando ou esperando você: uma linha do indicador no canto do canvas.
export type ActiveChat = {
  // Chave da conversa no app (a primeira dela, ver Chats.list) e a pasta onde roda.
  key: string
  cwd: string
  sessionId?: string
  status: Exclude<LiveStatus, 'idle'>
  activity?: ChatActivity
  // Subagentes em primeiro plano (o Claude está esperando por eles).
  foregroundAgents: number
  // Subagentes e comandos em segundo plano. Com o pedido já terminado, são eles que deixam a
  // conversa no indicador (status 'running', sem turnStartedAt).
  background: number
  turnStartedAt?: number
}

// Conversa com resposta que você ainda não viu (bolinha verde na lista), como a janela conta.
export type UnreadChat = { id: string; cwd: string; title: string }

// Conversa que parou no meio de um pedido sem você pedir: aparece interrompida (bolinha vermelha) até
// você continuar, mandar outra mensagem ou dispensar o aviso. Sem `reason`, o Argus fechou com ela
// trabalhando; 'memory', o sistema encerrou o Claude por falta de memória.
export type InterruptReason = 'memory'
export type InterruptedChat = { sessionId: string; cwd: string; reason?: InterruptReason }

// O que o mascote solto na tela mostra além do que as conversas ativas dizem. done: respostas não
// vistas que terminaram bem (check verde). failed: chaves das conversas que pararam com erro e
// você ainda não viu (aviso vermelho); a que acabou de parar conta por alguns segundos mesmo
// aberta na tela.
export type MascotAlerts = { done: number; failed: string[] }

// thinking: pensando ou esperando o modelo. writing: escrevendo a resposta. preparing: montando o
// pedido de uma ferramenta (o resumo chega aos poucos). running: ferramenta rodando.
export type ChatActivity = {
  kind: 'thinking' | 'writing' | 'preparing' | 'running'
  // Nome amigável da ferramenta e o alvo dela (arquivo, comando...), como na linha do chat.
  tool?: string
  summary?: string
  // Quando a etapa começou (ms).
  since: number
}

// Nova tentativa da API: o motivo, a tentativa (1 = a primeira nova tentativa), quantas no máximo e
// quando ela sai (ms).
export type ChatRetry = {
  cause: 'overloaded' | 'rate_limit' | 'server_error' | 'no_response' | 'other'
  attempt: number
  maxRetries: number
  at: number
}

// connecting: ligando ou reconectando. failed: não conectou (detail diz o motivo).
export type RemoteControl = { status: 'connecting' | 'connected' | 'failed'; url?: string; detail?: string }

export type ChatSettings = {
  model: string
  effort: string
  thinking: boolean
  ultracode: boolean
  permissionMode: string
}

export type ChatImage = { mediaType: string; data: string }

export type ChatSendRequest = {
  key: string
  cwd: string
  // Workspace: as pastas dele, que entram como pastas adicionais. O cwd é a pasta do workspace nos
  // dados do Argus (src/main/workspaces.ts).
  folders?: string[]
  // Conta do Claude escolhida no grupo da pasta. Vazia, removida ou desconhecida: a padrão.
  account?: string
  // Conversa existente: retoma a sessão. Vazio: conversa nova.
  sessionId?: string
  settings: ChatSettings
  text: string
  images: ChatImage[]
  // Anexos que não são imagem: o agente lê pelo caminho (ver attachedFiles).
  files?: AttachedFile[]
  // Aviso para o Claude que não aparece no chat (ex.: agentes chamados com @nome).
  hint?: string
}

// /remote-control: liga ou desliga. Sem sessão aberta, abre uma (por isso os dados da conversa).
export type ChatRemoteRequest = Omit<ChatSendRequest, 'text' | 'images' | 'files' | 'hint'> & { enabled: boolean }

// /output-style: o estilo de resposta em vigor na pasta (nome do Claude Code: "default", "Explanatory"...).
export type OutputStyleStatus = { ok: true; style: string } | { ok: false; error: string }
