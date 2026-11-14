import { useEffect, useState } from 'react';
import { tr } from '../i18n';
import { useHost, useStatus } from '../lib/host';
import { availabilityMessage, currentSubscription, disablePush, enablePush, pushAvailability } from '../lib/push';
import { Row, Section } from '../ui/List';
import { Toggle } from '../ui/Toggle';

// Ajustes > Notificações: ligar já pede a permissão (no toque), e o rodapé diz o que falta quando
// não dá (app fora da Tela de Início, permissão bloqueada, iPhone sem suporte).

// Voltando dos Ajustes do iPhone (onde a permissão é liberada), a tela confere de novo.
function useRecheckOnReturn(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && setTick((t) => t + 1);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return tick;
}

export function NotificationsSection() {
  const { conn } = useHost();
  const status = useStatus();
  const tick = useRecheckOnReturn();
  const [push, setPush] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const availability = pushAvailability();

  useEffect(() => {
    void currentSubscription().then(
      (s) => setPush(!!s && Notification.permission === 'granted'),
      () => setPush(false),
    );
  }, [tick]);

  const toggle = async (on: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      if (on) {
        const err = await enablePush(conn);
        setMessage(err);
        setPush(!err);
      } else {
        await disablePush(conn);
        setPush(false);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const footer =
    message ??
    (availability === 'ok'
      ? tr(
          'Avisa quando uma conversa termina, para com erro ou precisa de você, com o app fechado ou em segundo plano. Com o Argus aberto na tela, não avisa: você já está vendo.',
          'Alerts you when a chat finishes, fails or needs you, with the app closed or in the background. With Argus open on screen it does not alert: you are already looking.',
        )
      : availabilityMessage(availability));

  return (
    <Section title={tr('Notificações', 'Notifications')} footer={footer}>
      <Row
        title={tr('Avisar no celular', 'Alert on this phone')}
        trailing={
          <Toggle
            on={push && availability === 'ok'}
            label={tr('Avisar no celular', 'Alert on this phone')}
            disabled={availability !== 'ok' || busy || status !== 'online'}
            onChange={(on) => void toggle(on)}
          />
        }
      />
    </Section>
  );
}
