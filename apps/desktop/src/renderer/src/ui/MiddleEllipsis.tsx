import { useLayoutEffect, useRef, useState } from 'react';

let measureCanvas: HTMLCanvasElement | null = null;

// Largura do texto na fonte do elemento, sem precisar colocá-lo na tela.
function textWidth(text: string, el: HTMLElement): number {
  measureCanvas ??= document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = getComputedStyle(el).font;
  return ctx.measureText(text).width;
}

// Maior corte "começo…fim" que cabe em `width`, metade de cada lado.
function fitMiddle(text: string, el: HTMLElement, width: number): string {
  if (textWidth(text, el) <= width) return text;
  let low = 0;
  let high = text.length - 1;
  while (low < high) {
    const keep = Math.ceil((low + high) / 2);
    const head = Math.ceil(keep / 2);
    const candidate = `${text.slice(0, head)}…${text.slice(text.length - (keep - head))}`;
    if (textWidth(candidate, el) <= width) low = keep;
    else high = keep - 1;
  }
  const head = Math.ceil(low / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - (low - head))}`;
}

// Texto longo (caminho, comando) em uma linha só, cortado no meio: o começo e o fim ficam à vista.
export function MiddleEllipsis({ text, title, className }: { text: string; title?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(text);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const sync = () => setShown(fitMiddle(text, el, el.clientWidth));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div ref={ref} className={`min-w-0 overflow-hidden whitespace-nowrap ${className ?? ''}`} title={title ?? text}>
      {shown}
    </div>
  );
}
