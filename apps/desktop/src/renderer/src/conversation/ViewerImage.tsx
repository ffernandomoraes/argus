import { useState, type MouseEvent } from 'react';
import { Copy, FolderSearch } from 'lucide-react';
import { useZoomPan } from '@argus/ui/zoom/useZoomPan';
import { ContextMenu, type MenuState } from '../canvas/ContextMenu';
import { FILE_MANAGER } from '../platform';
import { tr } from '../i18n';

// PNG desenhado da própria imagem: para o anexo ainda não enviado (blob:) e para copiar, porque a
// área de transferência só aceita PNG.
function drawPng(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')?.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

const copyable = (src: string, img: HTMLImageElement) => (src.startsWith('data:image/png;') ? src : drawPng(img));
const revealable = (src: string, img: HTMLImageElement) => (src.startsWith('data:image/') ? src : drawPng(img));

// A imagem do visualizador: zoom (pinça do trackpad, Ctrl + roda, dois cliques) e, no botão
// direito, copiar ou mostrar no Finder. Montada de novo a cada imagem (key), o zoom recomeça.
export function ViewerImage({ src, alt }: { src: string; alt: string }) {
  const { bind } = useZoomPan<HTMLImageElement>();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const openMenu = (e: MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    const img = e.currentTarget;
    const run = (pick: typeof copyable, action: (dataUrl: string) => Promise<boolean>) => () => {
      void action(pick(src, img)).catch((err: unknown) => console.warn('[imagem] ação do menu falhou', err));
    };
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { type: 'action', label: tr('Copiar imagem', 'Copy image'), icon: Copy, onSelect: run(copyable, window.api.files.copyImage) },
        {
          type: 'action',
          label: tr(`Mostrar no ${FILE_MANAGER}`, `Show in ${FILE_MANAGER}`),
          icon: FolderSearch,
          onSelect: run(revealable, window.api.files.revealImage),
        },
      ],
    });
  };

  return (
    <>
      <img
        {...bind}
        src={src}
        alt={alt}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={openMenu}
        className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl shadow-black/60"
      />
      {menu && (
        <>
          {/* Clicar fora do menu só fecha o menu, não o visualizador (como no macOS). */}
          <div className="fixed inset-0 z-40" onMouseDown={(e) => e.stopPropagation()} />
          <ContextMenu menu={menu} onClose={() => setMenu(null)} />
        </>
      )}
    </>
  );
}
