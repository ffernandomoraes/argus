import { createContext, useContext, type MouseEvent as ReactMouseEvent } from 'react'
import type { XYPosition } from '@xyflow/react'
import type { LineRange } from '../conversation/fileLinks'
import type { ConversationSummary, ProjectData, TerminalKind } from './types'

// draft: conversa nova, que ainda não existe na lista da pasta.
// sessionId: id que o Claude deu à conversa nova no primeiro envio.
// nodeId nulo: conversa sem projeto que ainda não foi enviada; `at` é onde o botão direito foi dado.
// subagent: o drawer mostra o histórico de um subagente da conversa, só para ler.
export type ActiveConversation = {
  nodeId: string | null
  conversationId: string
  draft?: boolean
  sessionId?: string
  at?: XYPosition
  subagent?: SubagentRef
  tasks?: TasksRef
}

// Subagente lançado por uma conversa do Claude: a sessão dela e a chamada da ferramenta Agent.
export type SubagentRef = {
  sessionId: string
  toolUseId: string
  // Tipo do agente (Explore, general-purpose, um da biblioteca...) e a tarefa que recebeu.
  agent: string
  description: string
}

// Id do drawer de um subagente: não se confunde com o de nenhuma conversa.
export const subagentConversationId = (toolUseId: string): string => `subagent-${toolUseId}`

// Tarefa em segundo plano a mostrar (comando, monitor...): o id dela no Claude Code e o que o chat
// sabe dela. Aberta pelo chat, pode já ter terminado.
export type TaskRef = { id: string; description: string; command?: string; outputFile?: string }

// Drawer das tarefas em segundo plano de uma conversa: a saída de cada uma, só para ler.
export type TasksRef = {
  sessionId: string
  // A que aparece ao abrir; sem ela, a primeira.
  selected?: string
  // Aberta pelo chat ("Ver saída"): entra mesmo fora da lista das que estão rodando.
  extra?: TaskRef
}

// Id do drawer das tarefas de uma conversa: um por conversa.
export const tasksConversationId = (sessionId: string): string => `tasks-${sessionId}`

// Design aberto no drawer: um dos designs da pasta (nodeId). Novo: já nasce com o id que vai usar.
export type ActiveDesign = {
  nodeId: string
  designId: string
}

// Os comandos que os blocos e as barras pedem ao Canvas (montados em actions/useCanvasCommands).
// O objeto é criado uma vez e nunca muda: ler o contexto não faz ninguém redesenhar. O que muda
// com o uso (renomeando, conversa aberta, grupo destacado...) é lido por bloco em useCanvasView.ts.
export type CanvasActions = {
  startRename: (id: string) => void
  finishRename: (id: string, value: string | null) => void
  addGroup: (position: XYPosition) => void
  addFolder: (position: XYPosition, groupId?: string) => void
  // Espaço de trabalho antigo (ver ProjectData.folders): não se cria mais, mas os salvos continuam.
  addWorkspaceFolder: (id: string) => void
  removeWorkspaceFolder: (id: string, folder: string) => void
  // Nota nova já abre para escrever.
  addNote: (position: XYPosition, groupId?: string) => void
  // Fim da edição da nota (NoteNode): guarda o texto e sai da edição.
  finishNote: (id: string, text: string) => void
  // Fim do arraste do puxador da nota: guarda a largura escolhida.
  setNoteWidth: (id: string, width: number) => void
  // Seta do cabeçalho da nota: só o cabeçalho, ou o texto também.
  toggleNote: (id: string) => void
  // X do cabeçalho da nota: apaga sem perguntar (⌘Z traz de volta, como no menu).
  deleteNote: (id: string) => void
  toggleGroup: (id: string) => void
  toggleObscure: (id: string) => void
  toggleProject: (id: string) => void
  // "Tirar do grupo": o grupo encolhe, o bloco vai para fora e a câmera vai até ele.
  leaveGroup: (id: string) => void
  // "Mover para workspace": o bloco (com o que vai junto) sai daqui e entra no outro.
  moveToBoard: (id: string, board: string) => void
  openConversation: (nodeId: string, conversationId: string) => void
  // Histórico de um subagente, no drawer da conversa (por cima dela). Sem nodeId, vale o card da
  // pasta `path` (ou o da conversa solta).
  openSubagent: (nodeId: string | null, path: string, subagent: SubagentRef) => void
  // Saída das tarefas em segundo plano de uma conversa, no drawer dela (como o subagente).
  openTasks: (nodeId: string | null, path: string, tasks: TasksRef) => void
  newConversation: (nodeId: string) => void
  // "+" na borda do grupo: conversa nova do grupo todo (cria o card das conversas do grupo se faltar).
  newGroupConversation: (groupId: string) => void
  // Conversa sem projeto: abre o painel em branco e só entra no canvas no primeiro envio.
  // Sem posição, o card procura sozinho um lugar livre.
  newLooseConversation: (position?: XYPosition) => void
  // Botão direito numa conversa da lista da pasta: menu dela, não o da pasta.
  openConversationMenu: (e: ReactMouseEvent, nodeId: string, conversation: ConversationSummary) => void
  // Painel flutuante com todas as conversas da pasta.
  openAllConversations: (nodeId: string) => void
  // Drawer do modo design: um design da pasta (sem designId, um novo).
  openDesign: (nodeId: string, designId?: string) => void
  openSettings: () => void
  // Com projectPath, mostra só a memória daquela pasta.
  openMemory: (projectPath?: string) => void
  // Biblioteca de agentes globais.
  openAgents: () => void
  // Servidores locais que o Claude Code deixou rodando.
  openDevServers: () => void
  // Terminal no canvas; sem pasta (folder vazio), abre na do usuário.
  addTerminal: (position: XYPosition, groupId?: string, folder?: string, kind?: TerminalKind, account?: string, folders?: string[], name?: string) => void
  // Guarda no nó a conversa que o terminal criou, para ele retomá-la depois.
  bindTerminalSession: (nodeId: string, sessionId: string) => void
  // Conta escolhida na etiqueta do terminal; quem chama reabre o `claude` com ela.
  setTerminalAccount: (nodeId: string, account: string) => void
  closeTerminal: (nodeId: string, name: string) => void
  // Conversa no canvas (ChatPanelNode): fechar tira o bloco (a conversa continua salva); os outros
  // dois tiram o bloco e abrem a conversa no painel lateral ou numa janela própria.
  closeChatPanel: (nodeId: string) => void
  chatPanelToDrawer: (nodeId: string) => void
  chatPanelPopout: (nodeId: string) => void
  // Link de arquivo clicado numa conversa do canvas: abre o código daquela pasta.
  openFileFrom: (project: ProjectData, path: string, lines?: LineRange, diff?: boolean) => void
  // "Abrir ao lado" no plano (ou no .md criado) de uma conversa do canvas: à esquerda da tela.
  openPlanFrom: (text: string, path?: string) => void
  // Botão de código do card da pasta: abre o código dela; `open` (já aberto com ela) fecha.
  toggleProjectCode: (project: ProjectData, open: boolean) => void
  // Tarefa isolada (git worktree): remover a pasta (a branch fica).
  removeWorktree: (nodeId: string) => void
}

export const CanvasContext = createContext<CanvasActions | null>(null)

export function useCanvasActions(): CanvasActions {
  const ctx = useContext(CanvasContext)
  if (!ctx) throw new Error('useCanvasActions fora do Canvas')
  return ctx
}
