import type { RunningAgent } from './agents'
import type { DiffHunk, LiveStatus } from './history'

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
  // Remote control ligado: a conversa também pode ser continuada pelo claude.ai ou pelo celular.
  remote?: RemoteControl
  // Subagentes trabalhando agora, lançados por esta conversa.
  agents: RunningAgent[]
}

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
  // Conta do Claude escolhida no grupo da pasta. Vazia, removida ou desconhecida: a padrão.
  account?: string
  // Conversa existente: retoma a sessão. Vazio: conversa nova.
  sessionId?: string
  settings: ChatSettings
  text: string
  images: ChatImage[]
  // Aviso para o Claude que não aparece no chat (ex.: agentes chamados com @nome).
  hint?: string
}

// /remote-control: liga ou desliga. Sem sessão aberta, abre uma (por isso os dados da conversa).
export type ChatRemoteRequest = Omit<ChatSendRequest, 'text' | 'images' | 'hint'> & { enabled: boolean }
