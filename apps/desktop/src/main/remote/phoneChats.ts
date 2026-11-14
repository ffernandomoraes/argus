import type { Page } from '../ipc/page';

// Conversas em que alguém mexeu pelo celular (mandou mensagem ou respondeu um pedido): só delas sai
// notificação, e só para o celular que mexeu. Conversando pelo desktop (ou pela janela de outro
// computador), a conversa volta a ser "do desktop" e para de notificar. Na memória: reabrir o Argus
// começa sem nenhuma.

const phonePages = new WeakSet<Page>();
// Chave da conversa (ou id da sessão) -> aparelhos que mexeram nela.
const chats = new Map<string, Set<string>>();

export function registerPhonePage(page: Page): void {
  phonePages.add(page);
}

export const isPhonePage = (page: Page): boolean => phonePages.has(page);

export function markPhoneChat(deviceId: string, keys: (string | undefined)[]): void {
  for (const key of keys) {
    if (!key) continue;
    const devices = chats.get(key) ?? new Set<string>();
    devices.add(deviceId);
    chats.set(key, devices);
  }
}

export function forgetPhoneChat(keys: (string | undefined)[]): void {
  for (const key of keys) if (key) chats.delete(key);
}

// Aparelhos que mexeram na conversa (pela chave ou pelo id da sessão).
export function phoneDevicesOf(keys: (string | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const key of keys) for (const d of (key && chats.get(key)) || []) out.add(d);
  return out;
}
