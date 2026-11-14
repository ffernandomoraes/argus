import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { tr } from '../i18n';
import { useHost } from '../lib/host';
import { ImagePreview } from '../ui/ImagePreview';

// Imagens enviadas numa mensagem, como no balão do Argus: miniaturas pequenas em cima e
// "1 imagem enviada" embaixo delas; tocar abre o preview em tela cheia.

// Leituras guardadas por mensagem: a miniatura que volta à tela (ou a conversa reaberta) não pede
// de novo ao computador. Só as últimas ficam, para não segurar muitos prints na memória.
const KEEP = 30;
const cache = new Map<string, string[]>();

function remember(key: string, urls: string[]): void {
  cache.delete(key);
  cache.set(key, urls);
  if (cache.size > KEEP) cache.delete(cache.keys().next().value as string);
}

export const imageCountLabel = (n: number) => (n === 1 ? tr('1 imagem enviada', '1 image sent') : tr(`${n} imagens enviadas`, `${n} images sent`));

// Lê as imagens só quando o balão aparece na tela: conversa longa com muitos prints não lê todos.
function useImages(ref: { cwd: string; sessionId: string; messageId: string } | undefined, local: string[] | undefined) {
  const { conn } = useHost();
  const key = ref ? `${ref.sessionId}:${ref.messageId}` : '';
  const [urls, setUrls] = useState<string[] | null>(() => local ?? cache.get(key) ?? null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || urls || !ref) return;
    let alive = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      conn.call('sessions:images', ref.cwd, ref.sessionId, ref.messageId).then(
        (list) => {
          remember(key, list);
          if (alive) setUrls(list);
        },
        () => alive && setUrls([]),
      );
    });
    observer.observe(el);
    return () => {
      alive = false;
      observer.disconnect();
    };
    // ref chega novo a cada desenho; a chave diz se é a mesma mensagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave já identifica a mensagem
  }, [conn, key, urls]);
  return { box, urls };
}

export function UserImages({
  count,
  imageRef,
  local,
}: {
  count: number
  // Gravada no histórico: lida no computador.
  imageRef?: { cwd: string; sessionId: string; messageId: string }
  // A caminho: as imagens do próprio envio.
  local?: string[]
}) {
  const { box, urls } = useImages(imageRef, local);
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const slots = urls ?? Array.from({ length: imageRef ? count : 0 }, () => null);
  const canOpen = !!urls?.length;
  return (
    <div className="mb-1.5 flex flex-col items-start gap-1.5">
      {slots.length > 0 && (
        <div ref={box} className="flex flex-wrap gap-1.5">
          {slots.map((src, i) =>
            src ? (
              <button key={i} type="button" onClick={() => setOpen(i)} aria-label={tr('Ver imagem', 'View image')} className="overflow-hidden rounded-lg border border-white/30 active:opacity-70">
                <img src={src} alt="" className="size-12 object-cover" />
              </button>
            ) : (
              <div key={i} className="size-12 rounded-lg border border-white/30 bg-white/10" />
            ),
          )}
        </div>
      )}
      <button type="button" disabled={!canOpen} onClick={() => setOpen(0)} className="flex items-center gap-1.5 text-[12px] text-white/85 enabled:active:opacity-60">
        <ImageIcon size={12} className="shrink-0" />
        {imageCountLabel(count)}
      </button>
      {open !== null && urls && <ImagePreview urls={urls} start={open} onClose={close} />}
    </div>
  );
}
