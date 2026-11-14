import { useEffect, useRef, useState, type RefObject } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { tr } from '../i18n';
import { imageCountLabel } from './UserImages';

// O seu pedido do trecho que está na tela, preso embaixo do topo, como no Argus: aparece quando você
// rola para cima e o balão dele já saiu da tela; rolando para baixo, some. Tocar leva até ele.

// Quanto rolar numa direção para mostrar ou esconder (como no Argus).
const DIRECTION_PX = 60;
// Depois de arrastar o dedo, quanto tempo a rolagem conta como sua (o iPhone segue rolando sozinho).
const USER_SCROLL_MS = 1200;
// Perto do fim da conversa, o pedido preso some.
const NEAR_END_PX = 80;
// Folga entre o topo da tela e o balão, ao tocar para ir até ele (o topo flutuante cobre ~100px).
const JUMP_OFFSET_PX = 112;

type Pinned = { el: HTMLElement; text: string; images: number };

// O último balão seu que já subiu para trás do pedido preso (o pedido do trecho que está na tela).
function findPinned(line: number): Pinned | null {
  let found: HTMLElement | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-prompt]')) {
    if (el.getBoundingClientRect().bottom > line) break;
    found = el;
  }
  if (!found) return null;
  return { el: found, text: found.dataset.prompt ?? '', images: Number(found.dataset.images ?? 0) };
}

function usePinnedPrompt(bar: RefObject<HTMLElement | null>) {
  const [pinned, setPinned] = useState<Pinned | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let travel = 0;
    let movedAt = 0;
    const moved = () => {
      movedAt = Date.now();
    };
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      const nearEnd = document.documentElement.scrollHeight - (window.innerHeight + y) <= NEAR_END_PX;
      if (nearEnd) return setVisible(false);
      // Rolagem sozinha (a conversa descendo com a resposta) não mostra.
      if (Date.now() - movedAt > USER_SCROLL_MS) return;
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel <= -DIRECTION_PX) {
        const line = bar.current?.getBoundingClientRect().top ?? 0;
        const next = findPinned(line);
        setPinned((prev) => (prev?.el === next?.el && prev?.text === next?.text ? prev : next));
        setVisible(true);
      } else if (travel >= DIRECTION_PX) setVisible(false);
    };
    const opts = { passive: true };
    window.addEventListener('touchmove', moved, opts);
    window.addEventListener('wheel', moved, opts);
    window.addEventListener('scroll', onScroll, opts);
    return () => {
      window.removeEventListener('touchmove', moved);
      window.removeEventListener('wheel', moved);
      window.removeEventListener('scroll', onScroll);
    };
  }, [bar]);
  return { pinned, visible: visible && !!pinned, hide: () => setVisible(false) };
}

export function PinnedPrompt({ stick }: { stick: RefObject<boolean> }) {
  const bar = useRef<HTMLButtonElement>(null);
  const { pinned, visible, hide } = usePinnedPrompt(bar);
  const jump = () => {
    if (!pinned?.el.isConnected) return hide();
    // Indo para trás, a conversa não volta sozinha para o fim quando chega coisa nova.
    stick.current = false;
    const top = pinned.el.getBoundingClientRect().top + window.scrollY - JUMP_OFFSET_PX;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    hide();
  };
  return (
    <div className="px-safe pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+66px)] z-20">
      <button
        ref={bar}
        type="button"
        onClick={jump}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        aria-label={tr('Ir para o pedido', 'Go to the request')}
        className={`w-full rounded-[16px] border border-line bg-card px-3.5 py-2 text-left text-[14px] leading-snug shadow-[0_4px_16px_rgba(0,0,0,0.10)] transition-[opacity,translate] duration-200 ease-out active:opacity-70 ${
          visible ? 'pointer-events-auto opacity-100' : '-translate-y-1.5 opacity-0'
        }`}
      >
        {pinned?.text ? (
          <span className="line-clamp-2 break-words whitespace-pre-wrap">{pinned.text}</span>
        ) : (
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            <ImageIcon size={14} className="shrink-0" />
            {imageCountLabel(pinned?.images || 1)}
          </span>
        )}
      </button>
    </div>
  );
}
