import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { tr } from '../i18n';
import { lockPage, unlockPage } from './Sheet';

// Preview das imagens enviadas numa mensagem, em tela cheia sobre fundo escuro (como o do Argus).
// Várias imagens: passa uma para o lado. Fecha no X ou tocando fora da imagem.
export function ImagePreview({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lockPage();
    const el = strip.current;
    // Abre na imagem tocada.
    if (el) el.scrollLeft = start * el.clientWidth;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      unlockPage();
      window.removeEventListener('keydown', onKey);
    };
  }, [start, onClose]);

  return createPortal(
    <div className="screen-fade fixed inset-0 z-50 bg-black/92" role="dialog" aria-modal="true" aria-label={tr('Imagem', 'Image')}>
      <div ref={strip} className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'none' }}>
        {urls.map((src, i) => (
          <div
            key={i}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center p-4 pt-[max(56px,calc(env(safe-area-inset-top)+48px))] pb-[max(24px,env(safe-area-inset-bottom))]"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            <img src={src} alt={tr(`Imagem ${i + 1}`, `Image ${i + 1}`)} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(16px,env(safe-area-inset-top))] text-center text-[13px] leading-9 text-white/70">
          {tr(`${urls.length} imagens`, `${urls.length} images`)}
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={tr('Fechar', 'Close')}
        className="absolute top-[max(16px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))] flex size-9 items-center justify-center rounded-full bg-white/15 text-white active:opacity-60"
      >
        <X size={20} />
      </button>
    </div>,
    document.body,
  );
}
