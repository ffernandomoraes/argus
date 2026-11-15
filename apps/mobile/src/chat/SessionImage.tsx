import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { tr } from '../i18n';
import { useHost } from '../lib/host';
import { ImagePreview } from '../ui/ImagePreview';

// A conversa da mensagem: com ela, imagens que o Claude leu ou citou abrem em tela cheia. Sem ela
// (a resposta ainda chegando), ficam como texto.
export const SessionImageContext = createContext<{ cwd: string; sessionId: string } | null>(null);

type State = 'idle' | 'loading' | 'open' | 'missing';

// Lê a imagem no computador ao tocar (o computador só devolve se o caminho aparece na conversa) e
// abre o preview. A lida fica guardada: tocar de novo abre na hora.
export function useSessionImage(file: string | null) {
  const session = useContext(SessionImageContext);
  const { conn } = useHost();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<State>('idle');
  const close = useCallback(() => setState('idle'), []);
  const open = () => {
    if (!session || !file || state === 'loading') return;
    if (url) return setState('open');
    setState('loading');
    conn.call('sessions:image', session.cwd, session.sessionId, file).then(
      (found) => {
        setUrl(found);
        setState(found ? 'open' : 'missing');
      },
      () => setState('missing'),
    );
  };
  const preview = state === 'open' && url ? <ImagePreview urls={[url]} start={0} onClose={close} /> : null;
  return { canOpen: !!session && !!file, open, state, preview };
}

// "abrindo…" enquanto lê; "não encontrada" quando o arquivo sumiu (print em pasta temporária).
export function ImageStatus({ state }: { state: State }) {
  if (state === 'loading') return <span className="text-faint"> - {tr('abrindo…', 'opening…')}</span>;
  if (state === 'missing') return <span className="text-faint"> - {tr('não encontrada', 'not found')}</span>;
  return null;
}

// Link ou imagem da resposta que aponta para uma imagem no computador.
export function ImageLink({ file, children }: { file: string; children: ReactNode }) {
  const { canOpen, open, state, preview } = useSessionImage(file);
  if (!canOpen) return <span>{children}</span>;
  return (
    <>
      <button type="button" onClick={open} className="text-left text-accent underline underline-offset-2 active:opacity-60">
        {children}
      </button>
      <ImageStatus state={state} />
      {preview}
    </>
  );
}
