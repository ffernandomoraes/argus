import type { HistoryPage, Message } from './history';

// Histórico para o celular só com o que mudou. Enquanto o Claude trabalha, o celular relê as últimas
// mensagens a cada gravação, e cada leitura levava 40-60 KB pela ponte quando só 2-6 KB tinham mudado
// (medido em 2026-11-14). O celular manda a assinatura de cada mensagem que tem; o computador devolve
// a ordem de todas e, inteiras, só as novas ou diferentes.

// Assinatura de cada mensagem que o celular já tem, pelo id.
export type HistoryHave = Record<string, string>;

// ids: a página inteira, na ordem. changed: as que o celular não tem iguais.
export type HistoryPatch = { ids: string[]; changed: Message[]; more: boolean };

// cyrb53: 53 bits, rápido e sem dependência. Assinaturas iguais com mensagens diferentes deixariam
// uma mensagem velha na tela até a próxima mudança dela; com 53 bits, não acontece na prática.
function cyrb53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// A mesma nos dois lados: a mensagem chega ao celular pelo JSON, e o texto do JSON dela sai igual.
export function messageSignature(message: Message): string {
  return cyrb53(JSON.stringify(message));
}

// No computador: a página com só o que o celular não tem.
export function patchOf(page: HistoryPage, have: HistoryHave): HistoryPatch {
  return {
    ids: page.messages.map((m) => m.id),
    changed: page.messages.filter((m) => have[m.id] !== messageSignature(m)),
    more: page.more,
  };
}

// No celular: a página de novo, com as que ele já tinha. Nula se faltar alguma (não deveria).
export function applyPatch(patch: HistoryPatch, known: readonly Message[]): HistoryPage | null {
  const byId = new Map(known.map((m) => [m.id, m]));
  for (const m of patch.changed) byId.set(m.id, m);
  const messages: Message[] = [];
  for (const id of patch.ids) {
    const m = byId.get(id);
    if (!m) return null;
    messages.push(m);
  }
  return { messages, more: patch.more };
}
