import type { RefObject } from 'react';
import { ArrowDown } from 'lucide-react';
import { tr } from '../i18n';
import { useAwayFromEnd } from './useStickToBottom';

// Botão redondo em cima da caixa de escrever, quando você subiu na conversa: desce até o fim e volta
// a acompanhar a resposta chegando.
// bottom: a altura da caixa de escrever (o botão fica logo acima dela).
export function ScrollToEndButton({ stick, bottom }: { stick: RefObject<boolean>; bottom: number }) {
  const away = useAwayFromEnd();
  return (
    <button
      type="button"
      aria-label={tr('Ir para o fim da conversa', 'Jump to the end of the chat')}
      onClick={() => {
        stick.current = true;
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      }}
      className={`fixed left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-card text-text shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-opacity duration-200 active:opacity-60 ${
        away ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{ bottom: bottom + 8 }}
    >
      <ArrowDown size={20} />
    </button>
  );
}
