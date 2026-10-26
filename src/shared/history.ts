import type { AttachedFile } from './attachedFiles'

// Trecho de um arquivo alterado: linhas com " " (igual), "-" (removida) ou "+" (adicionada).
export type DiffHunk = { oldStart: number; newStart: number; lines: string[] }

// Mensagem da conversa como o chat mostra. at: quando foi gravada (ISO).
// tokens: tokens gerados pela resposta do Claude, contados na primeira parte dela.
// Marca de um pedido do modo design: o tipo (selecao, comentarios) e o texto curto.
export type MessageMark = { kind: string; text: string }

export type Message =
  // queued: enviada enquanto o Claude trabalhava; ele leva em conta no mesmo pedido.
  // images: quantos prints/imagens foram enviados junto da mensagem.
  | {
      id: string
      role: 'user'
      text: string
      at?: string
      queued?: boolean
      images?: number
      // O que foi junto do pedido no modo design (a parte selecionada, os comentários na página),
      // lido das marcas <argus-marca> do contexto; aparece discreto no balão.
      marks?: MessageMark[]
      // Anexos que não são imagem: cartões no balão, no lugar dos caminhos.
      files?: AttachedFile[]
    }
  | { id: string; role: 'assistant'; text: string; at?: string; tokens?: number }
  // Raciocínio do Claude antes de responder ou agir; recolhido no chat.
  | { id: string; role: 'thinking'; text: string; at?: string; tokens?: number; seconds?: number }
  // Resposta de um comando de barra (/context, /usage, /rename...), escrita pelo próprio
  // Claude Code, não pelo modelo.
  | { id: string; role: 'output'; text: string; at?: string }
  // Marco na conversa (troca de modelo, esforço, modo; compactação): vira um divisor no chat.
  | { id: string; role: 'event'; kind: EventKind; text: string; at?: string }
  | {
      id: string
      role: 'tool'
      at?: string
      tokens?: number
      // Nome da ferramenta no Claude Code (Bash, Read...) e como o app a mostra ("Comando", "Ler").
      name: string
      label: string
      // Para que serve a chamada: a intenção, não o comando.
      input: string
      // Comando, caminho ou endereço completo; aparece ao abrir a linha.
      detail?: string
      result: string
      error?: boolean
      diff?: DiffHunk[]
      // Arquivo .md criado (Write): o texto dele, que o chat mostra formatado, como o plano.
      document?: string
      // Id da chamada no Claude Code; liga a linha ao subagente rodando.
      toolUseId?: string
      // Subagente (ferramenta Agent): qual agente foi chamado.
      agent?: string
    }

export type EventKind = 'model' | 'effort' | 'mode' | 'thinking' | 'ultracode' | 'orchestrator' | 'compact' | 'interrupted'

// Status de uma sessão aberta do Claude Code (em qualquer lugar: VS Code, terminal, este app).
export type LiveStatus = 'running' | 'needs-you' | 'idle'

// Trecho do histórico pedido pela tela, contado do fim. since: a mensagem mais antiga que a tela
// já tem; o trecho começa nela e cresce com as novas, em vez de deslizar (as de cima sumiriam
// enquanto você lê). count: no mínimo quantas, contando do fim (ao abrir, ou ao carregar as anteriores).
export type HistoryRequest = { since?: string; count: number }
// more: há mensagens antes do trecho.
export type HistoryPage = { messages: Message[]; more: boolean }

// O trecho pedido de uma lista que vai até a última mensagem. `dropped`: quantas antigas já
// saíram da lista (contam para `more`).
export function pageOf(list: readonly Message[], request: HistoryRequest, dropped = 0): HistoryPage {
  const fromEnd = Math.max(0, list.length - Math.max(1, request.count))
  const at = request.since === undefined ? -1 : list.findIndex((m) => m.id === request.since)
  const start = at >= 0 ? Math.min(at, fromEnd) : fromEnd
  return { messages: list.slice(start), more: start > 0 || dropped > 0 }
}
