import { useState, type ReactNode } from 'react';
import { accountSwitchStops, joinStops } from '@argus/shared/accountSwitch';
import type { ChatState } from '@argus/shared/chat';
import { tr } from '../i18n';
import { ConfirmSheet } from '../ui/ConfirmSheet';

// Trocar a conta da conversa, como no Argus (conversation/header/useAccountSwitch.tsx). Parada: troca
// na hora. Com algo em andamento, pergunta antes dizendo o que vai parar: o Argus encerra a sessão e
// a próxima mensagem abre de novo na conta nova (ver shared/accountSwitch.ts).
export function useAccountSwitch(live: ChatState | null | undefined, apply: (account: string) => void): { choose: (account: string) => void; sheet: ReactNode } {
  const [asking, setAsking] = useState<string | null>(null);
  const stops = accountSwitchStops(live).map(([pt, en]) => tr(pt, en));
  const choose = (account: string) => (stops.length ? setAsking(account) : apply(account));
  const sheet = (
    <ConfirmSheet
      open={!!asking}
      title={tr('Trocar a conta agora?', 'Switch account now?')}
      message={tr(
        `A conversa continua de onde parou, na conta nova. Para isso, o que está em andamento nela para: ${joinStops(stops, 'e')}.`,
        `The chat continues where it left off, on the new account. To do that, what's in progress stops: ${joinStops(stops, 'and')}.`,
      )}
      confirmLabel={tr('Trocar e parar', 'Switch and stop')}
      danger
      onConfirm={() => asking && apply(asking)}
      onClose={() => setAsking(null)}
    />
  );
  return { choose, sheet };
}
