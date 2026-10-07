// Assistente do canvas: pedidos curtos (por voz ou texto) que o Claude cumpre mexendo nos blocos.

export type CanvasAgentState = {
  status: 'idle' | 'running'
  // Resposta do Claude ao último pedido.
  reply: string
  // O que ele está fazendo agora ("Movendo blocos"), enquanto roda.
  activity?: string
  error?: string
}

// Ferramenta que o main pede para a janela do canvas executar.
export type CanvasToolCall = { id: string; name: string; args: Record<string, unknown> }

// Resposta da janela: texto que volta para o Claude. error = a ação não foi feita.
export type CanvasToolResult = { id: string; text: string; error?: boolean }
