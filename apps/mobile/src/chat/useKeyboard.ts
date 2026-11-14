import { useEffect, useState, type RefObject } from 'react';

// Teclado do celular aberto, medido pela área visível (visualViewport): ela encolhe quando o teclado
// sobe. Com ele aberto, a caixa de escrever não precisa da folga da barra de baixo do iPhone.
//
// Também conserta o cursor do iPhone: com a caixa fixa embaixo e a página rolando por trás (a conversa
// descendo sozinha, o teclado abrindo), o Safari às vezes desenha o cursor fora do lugar, longe do
// texto. Repor a seleção do campo faz ele redesenhar o cursor onde deve.
export function useKeyboard(field: RefObject<HTMLTextAreaElement | null>): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    let frame = 0;
    const redrawCaret = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = field.current;
        if (!el || document.activeElement !== el) return;
        const { selectionStart, selectionEnd, selectionDirection } = el;
        el.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
      });
    };
    const measure = () => {
      if (vv) setOpen(window.innerHeight - vv.height > 120);
      redrawCaret();
    };
    measure();
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', redrawCaret);
    window.addEventListener('scroll', redrawCaret, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', redrawCaret);
      window.removeEventListener('scroll', redrawCaret);
    };
  }, [field]);
  return open;
}
