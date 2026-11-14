import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Gaveta que sobe de baixo, como as do iOS: fundo escurecido (tocar fecha), alça em cima, título e
// conteúdo que rola. Abre subindo com o fundo escurecendo e fecha descendo; com "reduzir movimento"
// ligado no sistema, só aparece e some (ver index.css). Enquanto aberta, a página de trás não rola.

const DURATION_MS = 280;

// Página de trás parada enquanto houver gaveta na tela. Contadas, e não "guardar e devolver o que
// estava": ao passar de uma gaveta para outra (menu + > Modelo), as duas ficam na tela juntas por um
// instante, e a segunda guardava o "parada" da primeira e o devolvia ao fechar: a conversa não
// rolava mais até recarregar o app.
let locks = 0;

export function lockPage(): void {
  if (locks++ === 0) document.body.style.overflow = 'hidden';
}

export function unlockPage(): void {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.body.style.overflow = '';
}

// above: por cima da camada de "sem ligação" (ConnectionOverlay), para a confirmação aberta nela.
export function Sheet({ open, onClose, title, children, above }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; above?: boolean }) {
  // mounted: está no DOM; shown: na posição aberta (a transição acontece entre os dois).
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Dois quadros: o primeiro desenha fechada, o segundo dispara a subida.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    lockPage();
    return unlockPage;
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div className={`fixed inset-0 ${above ? 'z-[60]' : 'z-40'} flex flex-col justify-end`} role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar"
        className={`sheet-motion absolute inset-0 bg-black/35 ${shown ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionProperty: 'opacity' }}
        onClick={onClose}
      />
      <div
        className={`sheet-motion pb-safe relative max-h-[82vh] overflow-y-auto rounded-t-[20px] bg-bg shadow-[0_-8px_30px_rgba(0,0,0,0.18)] ${
          shown ? 'translate-y-0' : 'translate-y-full'
        }`}
        // O Tailwind 4 move com a propriedade translate (não transform).
        style={{ transitionProperty: 'translate, transform' }}
      >
        <div className="sticky top-0 z-10 bg-bg px-4 pt-2 pb-2">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" />
          {title && <h2 className="text-center text-[15px] font-semibold">{title}</h2>}
        </div>
        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
