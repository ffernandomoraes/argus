import { useEffect, useRef, useState } from 'react';
import { tr } from '../i18n';
import { pairWithCode } from '../net/connection';
import { Section } from '../ui/List';

// Primeira vez: parear o app com o Argus de casa (só roda instalado; ver InstallScreen). Pelo QR code o código já vem no endereço
// (#pair=...) e o pareamento começa sozinho.
export function PairScreen({ initialCode, onPaired }: { initialCode?: string; onPaired: () => void }) {
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const pair = async (text: string) => {
    setBusy(true);
    setError(null);
    const err = await pairWithCode(text);
    setBusy(false);
    if (err) return setError(err);
    // O código não fica no endereço (nem no histórico).
    history.replaceState(null, '', '#/');
    onPaired();
  };

  useEffect(() => {
    if (initialCode && !started.current) {
      started.current = true;
      void pair(initialCode);
    }
  }, [initialCode]);

  return (
    <div className="pt-safe px-safe pb-safe flex min-h-full flex-col">
      <div className="flex flex-col items-center pt-12 pb-4 text-center">
        <img src="/icons/icon-192.png" alt="" className="size-20 rounded-[18px]" />
        <h1 className="mt-4 text-[26px] font-bold">Argus</h1>
        <p className="mt-2 max-w-[320px] text-[15px] leading-snug text-muted">
          {tr('Acompanhe e comande as conversas do Argus do seu computador.', 'Follow and drive the Argus chats on your computer.')}
        </p>
      </div>
      <Section
        title={tr('Parear com o computador', 'Pair with the computer')}
        footer={tr(
          'No computador: Argus > Configurações > Acesso remoto > Gerar código. Aponte a câmera para o QR code ou digite o código aqui.',
          'On the computer: Argus > Settings > Remote access > Generate code. Point the camera at the QR code or type the code here.',
        )}
      >
        <form
          className="flex items-center gap-2 px-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim() && !busy) void pair(code);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="K7Q4M-913776"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label={tr('Código de pareamento', 'Pairing code')}
            className="min-w-0 flex-1 bg-transparent py-1.5 font-mono tracking-wider uppercase outline-none placeholder:text-faint"
          />
          <button type="submit" disabled={!code.trim() || busy} className="rounded-full bg-accent px-4 py-1.5 text-[14px] font-semibold text-white disabled:opacity-40">
            {busy ? tr('Pareando…', 'Pairing…') : tr('Parear', 'Pair')}
          </button>
        </form>
      </Section>
      {error && <p className="mt-3 px-4 text-[14px] leading-snug text-red">{error}</p>}
      <p className="mt-auto px-4 pt-10 text-center text-[12px] leading-snug text-faint">
        {tr(
          'A ligação é cifrada de ponta a ponta: só este aparelho e o seu computador leem o que passa.',
          'The connection is end-to-end encrypted: only this device and your computer can read what goes through.',
        )}
      </p>
    </div>
  );
}
