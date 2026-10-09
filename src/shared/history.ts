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
      // Id da chamada no Claude Code; liga a linha ao subagente rodando.
      toolUseId?: string
      // Subagente (ferramenta Agent): qual agente foi chamado.
      agent?: string
    }

export type EventKind = 'model' | 'effort' | 'mode' | 'thinking' | 'ultracode' | 'compact'

// Status de uma sessão aberta do Claude Code (em qualquer lugar: VS Code, terminal, este app).
export type LiveStatus = 'running' | 'needs-you' | 'idle'
