import { app, Notification, powerSaveBlocker } from 'electron';
import type { RemoteAccessState, RemotePairResult } from '@argus/shared/remote';
import { loadAppSettings } from '../appSettings';
import { tr } from '../i18n';
import { formatPairCode, newPairCode, parsePairCode, type PairCode } from './crypto';
import { acceptSession, HandshakeError, openSession, pairAsClient, pairAsHost, PAIR_WAIT_MS } from './handshake';
import { RemoteClient } from './client';
import { RemoteHost, type HostSession } from './host';
import type { Link } from './link';
import { sendPush, type PushPayload } from './push';
import { connectPairing, connectToHost, HostRelay, RelayError, relayWebUrl } from './relay';
import { loadRemoteStore, newDeviceId, saveRemoteStore, type PairedDevice, type RemoteStore } from './store';
import { WebHostSession } from './webHost';

// O acesso remoto deste computador, dos dois lados:
// - de casa (hosting): fica ligado à ponte, aceita os aparelhos pareados e mostra o código de
//   pareamento;
// - notebook: pareia com um código e abre o Argus de outro computador numa janela.

type Deps = {
  hostName: () => string
  hostInfo: ConstructorParameters<typeof RemoteHost>[0]
  openWindow: (client: RemoteClient) => Promise<void>
  focus: (client: RemoteClient) => void
  onChange: (state: RemoteAccessState) => void
};

// Aviso no computador de casa quando um aparelho entra, mas não a cada religada (Wi-Fi instável).
const QUIET_RECONNECT_MS = 5 * 60 * 1000;

function failure(err: unknown): string {
  if (err instanceof HandshakeError || err instanceof RelayError) return err.userMessage;
  return err instanceof Error ? err.message : String(err);
}

export class RemoteAccess {
  private store: RemoteStore = loadRemoteStore();
  private host: RemoteHost;
  private relay: HostRelay | null = null;
  // Aparelho → sessões abertas agora (de outro Argus ou do app do celular).
  private live = new Map<string, Set<HostSession | WebHostSession>>();
  private pairing: { code: PairCode; expiresAt: number; link: Link | null; timer: NodeJS.Timeout } | null = null;
  private pairingResult: RemoteAccessState['pairingResult'] = null;
  private clients = new Map<string, RemoteClient>();
  // Bloqueio do sono do sistema enquanto hospeda (ver keepAwake); separado do app/keepAwake.ts, que
  // segura enquanto alguma conversa trabalha.
  private awake: number | null = null;

  constructor(private deps: Deps) {
    this.host = new RemoteHost(deps.hostInfo);
  }

  start(): void {
    if (this.store.hosting) this.startHosting();
  }

  state(): RemoteAccessState {
    return {
      hosting: this.store.hosting,
      keepAwake: this.store.keepAwake,
      relay: this.relay?.status ?? 'offline',
      name: this.deps.hostName(),
      devices: this.store.devices.map((d) => ({
        id: d.id,
        name: d.name,
        pairedAt: d.pairedAt,
        lastSeen: d.lastSeen ?? null,
        connected: !!this.live.get(d.id)?.size,
        web: d.kind === 'web',
      })),
      // O código só aparece com a vaga já reservada na ponte: digitado antes, daria "nenhum pareamento".
      pairing: this.pairing?.link
        ? {
            code: formatPairCode(this.pairing.code),
            // Depois do #: o navegador não manda essa parte para a ponte.
            url: `${relayWebUrl()}/#pair=${formatPairCode(this.pairing.code)}`,
            expiresAt: this.pairing.expiresAt,
          }
        : null,
      pairingResult: this.pairingResult,
      hosts: this.store.hosts.map((h) => ({ hostId: h.hostId, name: h.name, pairedAt: h.pairedAt, open: this.clients.has(h.hostId) })),
    };
  }

  private changed(): void {
    this.deps.onChange(this.state());
  }

  private save(): void {
    saveRemoteStore(this.store);
  }

  // --- Computador de casa ---

  setHosting(on: boolean): RemoteAccessState {
    this.store.hosting = on;
    this.save();
    if (on) this.startHosting();
    else this.stopHosting();
    this.changed();
    return this.state();
  }

  setKeepAwake(on: boolean): RemoteAccessState {
    this.store.keepAwake = on;
    this.save();
    this.syncAwake();
    this.changed();
    return this.state();
  }

  // A tela pode apagar ('prevent-app-suspension'); só o sistema não dorme.
  private syncAwake(): void {
    const want = !!this.relay && this.store.keepAwake;
    const holding = this.awake !== null && powerSaveBlocker.isStarted(this.awake);
    if (want && !holding) this.awake = powerSaveBlocker.start('prevent-app-suspension');
    else if (!want && holding) {
      powerSaveBlocker.stop(this.awake!);
      this.awake = null;
    }
  }

  private startHosting(): void {
    if (this.relay) return;
    this.relay = new HostRelay(this.store.hostId, this.store.hostKey, (link, authenticated) => void this.incoming(link, authenticated), () => this.changed());
    this.relay.start();
    this.syncAwake();
  }

  private stopHosting(): void {
    this.relay?.stop();
    this.relay = null;
    this.syncAwake();
    this.host.closeAll();
    for (const sessions of this.live.values()) for (const s of [...sessions]) s.close();
    this.cancelPairing();
  }

  private async incoming(raw: Link, authenticated: () => void): Promise<void> {
    let session: Awaited<ReturnType<typeof acceptSession>>;
    try {
      session = await acceptSession(raw, (id) => {
        const device = this.store.devices.find((d) => d.id === id);
        return device ? Buffer.from(device.psk, 'base64') : null;
      });
    } catch (err) {
      // A ligação crua já fechou no aperto de mão (libera a vaga na ponte).
      console.warn('[remoto] conexão recusada:', failure(err));
      return;
    }
    authenticated();
    const device = this.store.devices.find((d) => d.id === session.deviceId);
    if (!device) return session.link.close();
    const quiet = !!device.lastSeen && Date.now() - device.lastSeen < QUIET_RECONNECT_MS;
    const hostSession = device.kind === 'web' ? this.acceptWeb(session.link, device) : this.host.accept(session.link);
    const sessions = this.live.get(device.id) ?? new Set<HostSession | WebHostSession>();
    sessions.add(hostSession);
    this.live.set(device.id, sessions);
    device.lastSeen = Date.now();
    this.save();
    session.link.onClose(() => {
      sessions.delete(hostSession);
      // A hora em que saiu conta para o aviso da próxima entrada.
      device.lastSeen = Date.now();
      this.save();
      this.changed();
    });
    if (!quiet) this.notifyConnected(device.name);
    this.changed();
  }

  // O app do celular: mensagens em JSON e só a lista curta de canais (ver webHost.ts).
  private acceptWeb(link: Link, device: PairedDevice): WebHostSession {
    return new WebHostSession(link, {
      info: () => ({ ...this.deps.hostInfo(), pushKey: this.store.pushKeys.publicKey }),
      push: (sub) => {
        if (sub) device.push = sub;
        else delete device.push;
        this.save();
      },
      pushTest: async () => {
        const sub = device.push;
        if (!sub) return 'none';
        const result = await sendPush(
          sub,
          { title: 'Argus', body: tr('Notificação de teste: está funcionando.', 'Test notification: it works.'), url: '#/settings', tag: 'argus-test' },
          this.store.pushKeys,
          relayWebUrl(),
        );
        if (result === 'gone' && device.push === sub) {
          delete device.push;
          this.save();
        }
        return result;
      },
      onEnd: () => {},
    });
  }

  // Uma conversa terminou, parou com erro ou precisa de você: vira notificação nos celulares com
  // notificações ligadas que não estão com o app aberto na tela agora.
  notifyDevices(payload: PushPayload): void {
    if (!this.store.hosting) return;
    for (const device of this.store.devices) {
      const sub = device.push;
      if (device.kind !== 'web' || !sub) continue;
      const watching = [...(this.live.get(device.id) ?? [])].some((s) => s instanceof WebHostSession && s.visible);
      if (watching) continue;
      void sendPush(sub, payload, this.store.pushKeys, relayWebUrl()).then((result) => {
        // Inscrição vencida (app removido, permissão retirada): para de tentar.
        if (result === 'gone' && device.push === sub) {
          delete device.push;
          this.save();
        }
      });
    }
  }

  private notifyConnected(name: string): void {
    if (!Notification.isSupported() || !loadAppSettings().notifications) return;
    new Notification({
      title: tr(`${name} entrou no Argus`, `${name} connected to Argus`),
      body: tr('Acesso remoto: este computador está sendo usado de outro.', 'Remote access: this computer is being used from another one.'),
    }).show();
  }

  // Código novo para parear um aparelho. Liga a hospedagem junto: sem ela, o aparelho pareado não
  // teria onde entrar.
  startPairing(): RemoteAccessState {
    this.cancelPairing();
    this.pairingResult = null;
    if (!this.store.hosting) {
      this.store.hosting = true;
      this.save();
      this.startHosting();
    }
    void this.waitForPairing(3);
    return this.state();
  }

  private async waitForPairing(attempts: number): Promise<void> {
    const code = newPairCode();
    const timer = setTimeout(() => this.cancelPairing(), PAIR_WAIT_MS);
    const pairing = { code, expiresAt: Date.now() + PAIR_WAIT_MS, link: null as Link | null, timer };
    this.pairing = pairing;
    this.changed();
    let link: Link;
    try {
      link = await connectPairing(code.nameplate, 'host');
    } catch (err) {
      clearTimeout(timer);
      if (this.pairing !== pairing) return;
      this.pairing = null;
      // Vaga do código ocupada por outro pareamento: outro código.
      if (err instanceof RelayError && err.reason === 'taken' && attempts > 1) return this.waitForPairing(attempts - 1);
      this.pairingResult = { ok: false, error: failure(err) };
      return this.changed();
    }
    if (this.pairing !== pairing) return void link.close();
    pairing.link = link;
    this.changed();
    try {
      const granted = await pairAsHost(link, code, (deviceName, psk, kind) => {
        const device: PairedDevice = { id: newDeviceId(), name: deviceName.slice(0, 80), psk: psk.toString('base64'), pairedAt: Date.now(), kind };
        this.store.devices = [...this.store.devices, device];
        this.save();
        return { hostId: this.store.hostId, hostName: this.deps.hostName(), deviceId: device.id, psk };
      });
      const device = this.store.devices.find((d) => d.id === granted.deviceId);
      this.pairingResult = { ok: true, name: device?.name ?? '' };
    } catch (err) {
      // Fechado de propósito (cancelado ou vencido) não é erro para mostrar.
      if (this.pairing === pairing) this.pairingResult = { ok: false, error: failure(err) };
    } finally {
      link.close();
      clearTimeout(timer);
      if (this.pairing === pairing) this.pairing = null;
      this.changed();
    }
  }

  cancelPairing(): void {
    const pairing = this.pairing;
    if (!pairing) return;
    this.pairing = null;
    clearTimeout(pairing.timer);
    pairing.link?.close();
    this.changed();
  }

  // Derruba a sessão do aparelho (ou de todos) sem desfazer o pareamento: ele pode entrar de novo.
  disconnect(id?: string): void {
    for (const [device, sessions] of this.live) {
      if (id && device !== id) continue;
      for (const s of [...sessions]) s.kick();
    }
    this.changed();
  }

  removeDevice(id: string): void {
    this.store.devices = this.store.devices.filter((d) => d.id !== id);
    this.save();
    for (const s of [...(this.live.get(id) ?? [])]) s.kick();
    this.live.delete(id);
    this.changed();
  }

  // --- Notebook ---

  async pair(text: string): Promise<RemotePairResult> {
    const code = parsePairCode(text);
    if (!code) return { ok: false, error: tr('O código tem 5 letras e números, um hífen e 6 números, como K7Q4M-913776.', 'The code has 5 letters and digits, a hyphen and 6 digits, like K7Q4M-913776.') };
    try {
      const link = await connectPairing(code.nameplate, 'client');
      const granted = await pairAsClient(link, code, this.deps.hostName()).finally(() => link.close());
      // Pareado de novo com o mesmo computador: vale o novo.
      this.store.hosts = [
        ...this.store.hosts.filter((h) => h.hostId !== granted.hostId),
        { hostId: granted.hostId, name: granted.hostName, deviceId: granted.deviceId, psk: granted.psk.toString('base64'), pairedAt: Date.now() },
      ];
      this.save();
      this.changed();
      return { ok: true, hostId: granted.hostId, name: granted.hostName };
    } catch (err) {
      return { ok: false, error: failure(err) };
    }
  }

  async open(hostId: string): Promise<string | null> {
    const existing = this.clients.get(hostId);
    if (existing) {
      this.deps.focus(existing);
      return null;
    }
    const known = this.store.hosts.find((h) => h.hostId === hostId);
    if (!known) return tr('Computador não pareado.', 'Computer not paired.');
    const psk = Buffer.from(known.psk, 'base64');
    const connect = async () => openSession(await connectToHost(hostId), known.deviceId, psk);
    let client: RemoteClient | null = null;
    try {
      const created: RemoteClient = new RemoteClient(await connect(), app.getVersion(), this.deps.hostName(), connect, () => {
        if (this.clients.get(hostId) === created) this.clients.delete(hostId);
        this.changed();
      });
      client = created;
      const info = await client.connect();
      // O nome pode ter mudado lá.
      if (info.name !== known.name) {
        known.name = info.name;
        this.save();
      }
      this.clients.set(hostId, client);
      await this.deps.openWindow(client);
      this.changed();
      return null;
    } catch (err) {
      client?.close();
      this.clients.delete(hostId);
      return failure(err);
    }
  }

  forgetHost(hostId: string): void {
    this.clients.get(hostId)?.close();
    this.clients.delete(hostId);
    this.store.hosts = this.store.hosts.filter((h) => h.hostId !== hostId);
    this.save();
    this.changed();
  }

  shutdown(): void {
    this.relay?.stop();
    for (const c of this.clients.values()) c.close();
  }
}
