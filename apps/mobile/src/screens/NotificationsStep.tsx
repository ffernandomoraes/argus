import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { tr } from '../i18n';
import { useHost } from '../lib/host';
import { currentSubscription, enablePush, mayAskForPush, setPushChoice } from '../lib/push';

// Primeira entrada no app instalado (depois do pareamento): pede para ligar as notificações, com
// botão (o iPhone só mostra o pedido no toque) e "Agora não". Aparece uma vez por aparelho: a
// escolha fica guardada e dá para mudar depois em Ajustes.

export type PushStep = 'check' | 'show' | 'hide';

// check: conferindo se este aparelho já tem a inscrição (de antes de existir este passo).
export function usePushStep(): [PushStep, () => void] {
  const [step, setStep] = useState<PushStep>(() => (mayAskForPush() ? 'check' : 'hide'));
  useEffect(() => {
    if (step !== 'check') return;
    void currentSubscription().then(
      (sub) => setStep(sub ? 'hide' : 'show'),
      () => setStep('show'),
    );
  }, [step]);
  const done = () => {
    setStep('hide');
    window.scrollTo(0, 0);
  };
  return [step, done];
}

export function NotificationsStep({ onDone }: { onDone: () => void }) {
  const { conn } = useHost();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direto do toque: o pedido de permissão vem antes de qualquer espera (ver enablePush).
  const enable = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const err = await enablePush(conn);
      if (err) setError(err);
      else onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    setPushChoice('skipped');
    onDone();
  };

  return (
    <div className="pt-safe px-safe pb-end flex min-h-full flex-col">
      <div className="flex flex-col items-center pt-14 pb-6 text-center">
        <span className="flex size-20 items-center justify-center rounded-[18px] bg-accent text-white">
          <Bell size={38} />
        </span>
        <h1 className="mt-4 text-[20px] font-bold">{tr('Ativar notificações', 'Turn on notifications')}</h1>
        <p className="mt-2 max-w-[320px] text-[15px] leading-snug text-muted">
          {tr(
            'O Argus avisa neste celular quando uma conversa termina, para com erro ou precisa de você, mesmo com o app fechado.',
            'Argus alerts you on this phone when a chat finishes, fails or needs you, even with the app closed.',
          )}
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void enable()}
        className="flex w-full items-center justify-center rounded-[12px] bg-accent py-3.5 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-60"
      >
        {busy ? tr('Ativando…', 'Turning on…') : tr('Ativar notificações', 'Turn on notifications')}
      </button>
      {error && <p className="mt-3 px-4 text-center text-[14px] leading-snug text-red">{error}</p>}
      <button type="button" onClick={skip} className="mt-2 w-full py-3 text-[15px] text-accent active:opacity-60">
        {tr('Agora não', 'Not now')}
      </button>

      <p className="mt-auto px-4 pt-10 text-center text-[12px] leading-snug text-faint">
        {tr('Dá para mudar depois em Ajustes > Notificações.', 'You can change this later in Settings > Notifications.')}
      </p>
    </div>
  );
}
