import { useState, type ReactNode } from 'react';
import { accountSwitchStops, joinStops } from '@argus/shared/accountSwitch';
import type { ChatState } from '@argus/shared/chat';
import { ConfirmDialog } from '../../canvas/ConfirmDialog';
import { Presence } from '../../motion';
import { tr } from '../../i18n';

// Trocar a conta da conversa. Parada: troca na hora. Com algo em andamento (resposta, subagentes,
// comandos em segundo plano, fila, remote control), pergunta antes dizendo o que vai parar: a troca
// encerra a sessão, que abre de novo na conta nova com a próxima mensagem (ver
// shared/accountSwitch.ts). Assim a conversa nunca segue gastando a conta de antes.
export function useAccountSwitch(live: ChatState | null | undefined, apply: (account: string) => void): { choose: (account: string) => void; dialog: ReactNode } {
  const [asking, setAsking] = useState<string | null>(null);
  const stops = accountSwitchStops(live).map(([pt, en]) => tr(pt, en));
  const choose = (account: string) => (stops.length ? setAsking(account) : apply(account));
  const dialog = (
    <Presence kind="modal">
      {asking && (
        <ConfirmDialog
          request={{
            title: tr('Trocar a conta agora?', 'Switch account now?'),
            description: tr(
              `A conversa continua de onde parou, na conta nova. Para isso, o que está em andamento nela para: ${joinStops(stops, 'e')}.`,
              `The chat continues where it left off, on the new account. To do that, what's in progress stops: ${joinStops(stops, 'and')}.`,
            ),
            confirmLabel: tr('Trocar e parar', 'Switch and stop'),
            onConfirm: () => apply(asking),
          }}
          onClose={() => setAsking(null)}
        />
      )}
    </Presence>
  );
  return { choose, dialog };
}
