// Conversa gravada pelo Claude Code em ~/.claude/projects/<pasta>/<id>.jsonl.
import type { LiveStatus } from './history'

export type SessionSummary = {
  // Id da sessão (nome do arquivo); serve para `claude --resume`.
  id: string
  title: string
  // Última gravação no arquivo, em ISO.
  updatedAt: string
  // Quanto da janela de contexto a última resposta ocupou, de 0 a 100.
  contextPercent: number
  // Nulo: nenhum processo do Claude Code está com a sessão aberta.
  live: LiveStatus | null
}
