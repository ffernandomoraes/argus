import type { ChatState } from '@argus/shared/chat';
import type { Message } from '../types';

// A resposta gravada que é a prévia na tela (o mesmo texto): a prévia sai e ela entra no lugar.
export function savedPreviewId(live: ChatState | null, messages: Message[]): string | null {
  if (!live?.partial) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant') return m.text === live.partial.trim() ? m.id : null;
  }
  return null;
}

export type PreviewKeys = {
  // Chamado a cada desenho, antes de montar os itens.
  update: (live: ChatState | null, messages: Message[]) => void
  // A chave da prévia que está sendo escrita agora.
  current: () => string
  // A chave de uma resposta gravada.
  keyOf: (id: string) => string
};

// Chaves da prévia (a resposta sendo escrita) na linha do tempo. A resposta que chega ao histórico
// fica com a chave da prévia que estava na tela: é o mesmo item, só com o conteúdo trocado. Com a
// chave da mensagem, o item nascia de novo: o texto sumia e voltava com a animação de passo novo, e
// a lista virtualizada o media como item novo e corrigia a rolagem, pulando o que você lia (a
// resposta terminava e, uns segundos depois, a tela piscava). Cada prévia nova tem chave própria.
// Resposta que já estava na tela antes de bater com a prévia continua com a dela.
export function createPreviewKeys(): PreviewKeys {
  let seq = 0;
  const taken = new Map<string, string>();
  // Respostas da leitura anterior do histórico (as que já estavam na tela).
  let shown = new Set<string>();
  let read: Message[] | null = null;
  return {
    update(live, messages) {
      const saved = savedPreviewId(live, messages);
      // A prévia saiu da tela: a próxima tem chave nova, e a resposta herda esta se acabou de chegar.
      if (saved !== null && !taken.has(saved)) {
        taken.set(saved, shown.has(saved) ? saved : `preview-${seq}`);
        seq++;
      }
      if (messages === read) return;
      read = messages;
      shown = new Set(messages.flatMap((m) => (m.role === 'assistant' ? [m.id] : [])));
    },
    current: () => `preview-${seq}`,
    keyOf: (id) => taken.get(id) ?? id,
  };
}
