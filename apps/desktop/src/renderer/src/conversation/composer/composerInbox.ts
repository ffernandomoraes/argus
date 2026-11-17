import { useEffect, useEffectEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';

// Texto mandado de fora para o campo de uma conversa (a seleção do editor de código, "Perguntar ao
// Claude"), pela chave do rascunho dela. A mesma conversa aberta em dois lugares (drawer e bloco do
// canvas): recebe o campo que apareceu por último.
const listeners = new Map<string, ((text: string) => void)[]>();

// Entrega o texto; false se a conversa não tem campo na tela.
export function sendToComposer(key: string, text: string): boolean {
  const list = listeners.get(key);
  const last = list?.[list.length - 1];
  if (!last) return false;
  last(text);
  return true;
}

// O texto recebido entra no fim do que já está escrito, e o foco vai para o campo (sem rolar o
// canvas, como o resto do Composer).
export function useComposerInbox(
  key: string,
  setDraft: Dispatch<SetStateAction<string>>,
  field: RefObject<HTMLTextAreaElement | null>,
): void {
  const receive = useEffectEvent((text: string) => {
    setDraft((d) => (d && !/\s$/.test(d) ? `${d} ${text}` : d + text));
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
  });
  useEffect(() => {
    const listener = (text: string) => receive(text);
    listeners.set(key, [...(listeners.get(key) ?? []), listener]);
    return () => {
      const rest = (listeners.get(key) ?? []).filter((l) => l !== listener);
      if (rest.length) listeners.set(key, rest);
      else listeners.delete(key);
    };
  }, [key]);
}
