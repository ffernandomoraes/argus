import { useEffect, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { tr } from '../i18n';
import { forgetPairedHost, type HostConnection } from '../net/connection';
import { useHost, useStatus } from '../lib/host';
import { disablePush } from '../lib/push';

// Esquece o computador neste aparelho e volta para a tela de pareamento.
function disconnect(conn: HostConnection, ask: boolean): void {
  if (ask && !confirm(tr(`Desconectar de ${conn.host.hostName}? Para entrar de novo, será preciso parear com um código novo.`, `Disconnect from ${conn.host.hostName}? To connect again you will need a new pairing code.`))) return;
  void disablePush(conn).catch(() => {});
  conn.stop();
  forgetPairedHost();
  location.hash = '';
  location.reload();
}

// Sem ligação com o computador de casa, nada na tela funciona: uma camada por cima de tudo bloqueia
// o app e diz o que está acontecendo. Religação rápida (a volta do fundo) não pisca: a camada só
// aparece depois de SHOW_AFTER_MS sem ligação.
const SHOW_AFTER_MS = 700;

export function ConnectionOverlay() {
  const { conn } = useHost();
  const status = useStatus();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (status === 'online') return setShown(false);
    const timer = setTimeout(() => setShown(true), status === 'connecting' ? SHOW_AFTER_MS : 0);
    return () => clearTimeout(timer);
  }, [status]);
  if (status === 'online' || !shown) return null;

  const name = conn.host.hostName;
  const busy = status === 'connecting' || status === 'offline';
  const title =
    status === 'connecting'
      ? tr(`Conectando a ${name}…`, `Connecting to ${name}…`)
      : status === 'offline'
        ? tr(`${name} não responde`, `${name} isn't answering`)
        : status === 'rejected'
          ? tr('Versões diferentes', 'Different versions')
          : status === 'kicked'
            ? tr('Desconectado', 'Disconnected')
            : tr('Pareamento desfeito', 'Pairing removed');
  const detail =
    status === 'offline'
      ? tr(
          'Desligado, dormindo, sem internet ou com o acesso remoto desligado. Tentando de novo…',
          'Off, asleep, offline or with remote access off. Retrying…',
        )
      : status === 'rejected'
        ? (conn.detail ?? tr('Esta versão do app não conversa com a do computador.', "This app version can't talk to the computer's."))
        : status === 'kicked'
          ? tr(`${name} desconectou este aparelho.`, `${name} disconnected this device.`)
          : status === 'unpaired'
            ? tr(`${name} não reconhece mais este aparelho. Pareie de novo.`, `${name} no longer recognizes this device. Pair again.`)
            : null;

  return (
    <div role="alertdialog" aria-busy={busy} aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 px-8 backdrop-blur-md">
      <div className="flex max-w-[320px] flex-col items-center text-center">
        {busy ? (
          status === 'offline' ? (
            <WifiOff size={30} className="text-muted" />
          ) : (
            <Loader2 size={30} className="animate-spin text-muted" />
          )
        ) : null}
        <p className="mt-3 text-[17px] font-semibold">{title}</p>
        {detail && <p className="mt-1 text-[15px] leading-snug text-muted">{detail}</p>}
        {(status === 'kicked' || status === 'rejected') && (
          <button type="button" className="mt-4 rounded-full bg-accent px-5 py-2 text-[15px] font-semibold text-white" onClick={() => location.reload()}>
            {tr('Tentar de novo', 'Try again')}
          </button>
        )}
        {status === 'unpaired' ? (
          <button type="button" className="mt-4 rounded-full bg-accent px-5 py-2 text-[15px] font-semibold text-white" onClick={() => disconnect(conn, false)}>
            {tr('Parear de novo', 'Pair again')}
          </button>
        ) : (
          <button type="button" className="mt-4 rounded-full bg-red/12 px-5 py-2 text-[15px] font-semibold text-red active:opacity-60" onClick={() => disconnect(conn, true)}>
            {tr('Desconectar', 'Disconnect')}
          </button>
        )}
      </div>
    </div>
  );
}
