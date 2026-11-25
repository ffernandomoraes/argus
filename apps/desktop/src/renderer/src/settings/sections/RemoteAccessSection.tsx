import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Loader2, Monitor, Settings2, Smartphone } from 'lucide-react';
import { useCopied } from '../../lib/useCopied';
import { IconButton } from '../../ui/IconButton';
import { useRemoteAccess } from '../../remote';
import type { RemoteAccessState } from '@argus/shared/remote';
import { LOCALE, tr } from '../../i18n';
import { EmptyState } from '../../ui/emptyState/EmptyState';
import { RemoteDevicesArt } from '../../ui/emptyState/illustrations';
import { Button } from '../../ui/Button';
import { Group, Row, Switch } from '../controls';
import { Tabs } from '../Tabs';
import { RemoteAccountHosts } from './RemoteAccountHosts';
import { FIELD } from '../fieldStyles';

// Acesso remoto: usar o Argus deste computador de outro (o notebook no trabalho), ou
// abrir daqui o de outro computador. A ligação passa pela ponte do Argus na internet, cifrada de
// ponta a ponta (ver src/main/remote).

const date = (ms: number) => new Date(ms).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });

// Segundos até o código vencer, contando na tela.
function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, Math.round((until - now) / 1000)) : 0;
}

// O QR code do pareamento: abre o app do celular já com o código (depois do #, que não sai do
// aparelho). Escuro no branco, o que as câmeras leem melhor, nos dois temas.
function PairQr({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }).then(
      (data) => alive && setSrc(data),
      () => alive && setSrc(null),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  if (!src) return null;
  return <img src={src} alt={tr('QR code do pareamento', 'Pairing QR code')} className="size-[180px] rounded-lg bg-white p-1" />;
}

// Copiar o código (para mandar a si mesmo, por exemplo); um visto confirma por um instante.
function CopyCode({ code }: { code: string }) {
  const { copied, copy } = useCopied();
  return (
    <IconButton size="md" label={copied ? tr('Copiado', 'Copied') : tr('Copiar código', 'Copy code')} onClick={() => copy(code)}>
      {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
    </IconButton>
  );
}

function relayText(s: RemoteAccessState): string {
  if (!s.hosting) return tr('Desligado: nenhum outro computador entra.', 'Off: no other computer can connect.');
  if (s.relay === 'online' && s.account === 'on') {
    return tr('Ligado - os aparelhos pareados e os da sua conta do Argus podem entrar.', 'On - paired devices and the ones in your Argus account can connect.');
  }
  if (s.relay === 'online') return tr('Ligado - os aparelhos pareados podem entrar.', 'On - paired devices can connect.');
  if (s.relay === 'connecting') return tr('Ligando à ponte do acesso remoto…', 'Connecting to the remote access relay…');
  return tr('Sem conexão com a ponte. Tentando de novo…', 'No connection to the relay. Retrying…');
}

type Tab = 'general' | 'devices' | 'computers';

// Três abas: o que este computador oferece (ligar, manter acordado, parear), os aparelhos que entram
// nele e os outros computadores que este abre.
export function RemoteAccessSection() {
  const state = useRemoteAccess();
  const [tab, setTab] = useState<Tab>('general');
  if (!state) return null;
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        label={tr('Acesso remoto', 'Remote access')}
        options={[
          { value: 'general', label: tr('Geral', 'General'), icon: <Settings2 size={15} /> },
          { value: 'devices', label: tr('Aparelhos conectados', 'Connected devices'), icon: <Smartphone size={15} /> },
          { value: 'computers', label: tr('Conexão a outros computadores', 'Connect to other computers'), icon: <Monitor size={15} /> },
        ]}
      />
      {tab === 'general' && <ThisComputer state={state} />}
      {tab === 'devices' && <Devices state={state} />}
      {tab === 'computers' && <OtherComputers state={state} />}
    </>
  );
}

// Texto da aba sem nada na lista, no lugar das linhas.
function ThisComputer({ state }: { state: RemoteAccessState }) {
  return (
    <Group>
      <Row label={tr('Permitir acesso de outros computadores', 'Allow access from other computers')} description={relayText(state)}>
        <Switch label={tr('Permitir acesso', 'Allow access')} checked={state.hosting} onChange={(on) => void window.api.remoteAccess.setHosting(on)} />
      </Row>
      <Row
        label={tr('Manter este computador acordado', 'Keep this computer awake')}
        description={tr('Com o acesso ligado, o sistema não dorme; a tela pode apagar.', 'With access on, the system doesn’t sleep; the screen can turn off.')}
        info={tr(
          'Dormindo, o computador sai da internet e ninguém de longe consegue acordá-lo. Num notebook, fechar a tampa ainda faz ele dormir, a menos que esteja na tomada com um monitor externo.',
          'Asleep, the computer drops off the internet and no one can wake it from afar. On a laptop, closing the lid still puts it to sleep, unless it is plugged in with an external display.',
        )}
      >
        <Switch label={tr('Manter acordado', 'Keep awake')} checked={state.keepAwake} onChange={(on) => void window.api.remoteAccess.setKeepAwake(on)} />
      </Row>
    </Group>
  );
}

// Parear: o botão que gera o código e, gerado, o código com o QR code. Fica em cima da lista dos
// aparelhos, que é onde o aparelho novo aparece.
function PairDevice({ state }: { state: RemoteAccessState }) {
  const left = useCountdown(state.pairing?.expiresAt ?? null);
  // Gerando o código (a ponte pode demorar): o botão gira até o código e o QR code aparecerem.
  const [starting, setStarting] = useState(false);
  // O botão segue aceso (desligado ele apagaria o giro); o clique repetido é ignorado.
  const startPairing = () => {
    if (starting) return;
    setStarting(true);
    void window.api.remoteAccess.startPairing().finally(() => setStarting(false));
  };
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <>
        <Row
          label={tr('Parear um aparelho', 'Pair a device')}
          description={tr(
            'Gera um código para digitar no outro computador, ou um QR code para abrir no celular.',
            'Generates a code to type on the other computer, or a QR code to open on your phone.',
          )}
          info={tr(
            'O código vale por 10 minutos e para um aparelho só. Errado uma vez, ele deixa de valer. Quem tem o aparelho pareado vê e controla tudo deste Argus: conversas, terminais e arquivos dos projetos.',
            'The code is valid for 10 minutes and for one device only. One wrong try and it stops working. Whoever has the paired device sees and controls all of this Argus: chats, terminals and project files.',
          )}
        >
          {state.pairing ? (
            <Button variant="secondary" onClick={() => window.api.remoteAccess.cancelPairing()}>
              {tr('Cancelar', 'Cancel')}
            </Button>
          ) : (
            <Button variant="secondary" aria-busy={starting} onClick={startPairing}>
              {starting && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              {starting ? tr('Gerando…', 'Generating…') : tr('Gerar código', 'Generate code')}
            </Button>
          )}
        </Row>
        {state.pairing && (
          <div className="flex flex-col items-center gap-1 border-b border-dashed border-line py-4 last:border-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[28px] font-semibold tracking-[0.15em] text-text select-all">{state.pairing.code}</span>
              <CopyCode code={state.pairing.code} />
            </div>
            <span className="text-[15px] text-muted">
              {tr(`Digite no outro computador - vence em ${clock}`, `Type it on the other computer - expires in ${clock}`)}
            </span>
            <div className="mt-3">
              <PairQr url={state.pairing.url} />
            </div>
            <span className="max-w-[340px] text-center text-[15px] text-muted">
              {tr('Ou aponte a câmera do celular para o QR code.', 'Or point your phone camera at the QR code.')}
            </span>
          </div>
        )}
        {/* Pareou: o aparelho já aparece na lista de pareados, sem aviso. Só o erro fica à vista. */}
        {!state.pairing && state.pairingResult && !state.pairingResult.ok && (
          <p className="border-b border-dashed border-line py-3 text-[15px] text-red-400 last:border-0">{state.pairingResult.error}</p>
        )}
    </>
  );
}

function Devices({ state }: { state: RemoteAccessState }) {
  return (
    <Group>
      <PairDevice state={state} />
      {!state.devices.length && (
        <EmptyState
          art={<RemoteDevicesArt />}
          title={tr('Nenhum aparelho pareado', 'No paired devices')}
          text={tr(
            'Pareie o celular ou outro computador aqui em cima para acompanhar e mandar mensagens às conversas de longe.',
            'Pair your phone or another computer above to follow and message your chats from anywhere.',
          )}
        />
      )}
        {state.devices.map((d) => (
          <Row
            key={d.id}
            label={d.name}
            description={
              (d.web ? tr('Celular (navegador) - ', 'Phone (browser) - ') : '') +
              (d.connected
                ? tr('Conectado agora', 'Connected now')
                : d.lastSeen
                  ? tr(`Última vez: ${date(d.lastSeen)}`, `Last seen: ${date(d.lastSeen)}`)
                  : tr(`Pareado em ${date(d.pairedAt)}`, `Paired on ${date(d.pairedAt)}`))
            }
            info={tr(
              'Remover desconecta o aparelho na hora e ele não entra mais. Se ele entrou pela conta do Argus, sai da conta também. O que já foi feito por ele (comandos nos terminais, arquivos alterados) continua como está.',
              'Removing disconnects the device right away and it can no longer connect. If it came in through your Argus account, it leaves the account too. What it already did (terminal commands, changed files) stays as it is.',
            )}
          >
            <Button variant="secondary" danger onClick={() => window.api.remoteAccess.removeDevice(d.id)}>
              {tr('Remover', 'Remove')}
            </Button>
          </Row>
        ))}
    </Group>
  );
}

function OtherComputers({ state }: { state: RemoteAccessState }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, job: () => Promise<string | null>) => {
    setBusy(key);
    setError(null);
    try {
      setError(await job());
    } finally {
      setBusy(null);
    }
  };

  const pair = () =>
    run('pair', async () => {
      const result = await window.api.remoteAccess.pair(code);
      if (!result.ok) return result.error;
      setCode('');
      return window.api.remoteAccess.open(result.hostId);
    });

  return (
    <>
      <RemoteAccountHosts state={state} />
      <Group>
        {state.hosts.map((h) => (
          <Row
            key={h.hostId}
            label={h.name}
            description={h.open ? tr('Aberto numa janela', 'Open in a window') : tr(`Pareado em ${date(h.pairedAt)}`, `Paired on ${date(h.pairedAt)}`)}
          >
            <div className="flex gap-2">
              <Button variant="secondary" danger onClick={() => window.api.remoteAccess.forgetHost(h.hostId)}>
                {tr('Esquecer', 'Forget')}
              </Button>
              <Button variant="primary" disabled={busy !== null} onClick={() => void run(h.hostId, () => window.api.remoteAccess.open(h.hostId))}>
                {busy === h.hostId ? tr('Abrindo…', 'Opening…') : h.open ? tr('Mostrar', 'Show') : tr('Abrir', 'Open')}
              </Button>
            </div>
          </Row>
        ))}
        <Row
          label={tr('Conectar a outro Argus', 'Connect to another Argus')}
          description={tr(
            'Gere o código no outro computador, em Acesso remoto - Aparelhos conectados.',
            'Generate the code on the other computer, under Remote access - Connected devices.',
          )}
        >
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim() && !busy) void pair();
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="K7Q4M-913776"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label={tr('Código de pareamento', 'Pairing code')}
              className={`${FIELD} w-48 font-mono uppercase`}
            />
            <Button type="submit" variant="primary" disabled={!code.trim() || busy !== null}>
              {busy === 'pair' ? tr('Pareando…', 'Pairing…') : tr('Parear', 'Pair')}
            </Button>
          </form>
        </Row>
        {error && <p className="border-b border-dashed border-line py-3 text-[15px] text-red-400 last:border-0">{error}</p>}
      </Group>
    </>
  );
}
