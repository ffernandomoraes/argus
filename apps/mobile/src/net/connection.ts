import {
  decodeWeb,
  encodeWeb,
  WEB_PROTOCOL_VERSION,
  type WebChannel,
  type WebClientMessage,
  type WebHostInfo,
  type WebPushSubscription,
} from '@argus/shared/webRemote';
import type { EventChannels, InvokeChannels, SendChannels, SendSyncChannels } from '@argus/shared/ipc';
import { tr } from '../i18n';
import type { Link } from './crypto';
import { HandshakeError, openSession } from './handshake';
import { openSocket, relayBase, unb64, type PairedHost } from './pairing';

export { forgetPairedHost, loadPairedHost, pairWithCode, relayBase, type PairedHost } from './pairing';

// A ligação do app do celular com o Argus de casa, pela ponte: abre, cifra (handshake.ts), religa
// sozinha quando cai e entrega pedidos e avisos às telas.

// --- A conexão com o computador pareado ---

// connecting: abrindo ou religando. offline: o de casa não responde (desligado, dormindo, sem
// internet ou com o acesso desligado). rejected: versões que não conversam. kicked: o de casa
// desconectou este aparelho. unpaired: o de casa não conhece mais este aparelho.
export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'rejected' | 'kicked' | 'unpaired';

type Args<C> = C extends keyof InvokeChannels
  ? Parameters<InvokeChannels[C]>
  : C extends keyof SendChannels
    ? Parameters<SendChannels[C]>
    : C extends keyof SendSyncChannels
      ? Parameters<SendSyncChannels[C]>
      : never;
type Result<C> = C extends keyof InvokeChannels
  ? Awaited<ReturnType<InvokeChannels[C]>>
  : C extends keyof SendSyncChannels
    ? ReturnType<SendSyncChannels[C]>
    : void;

type Listener = (...args: never[]) => void;

// Entre as tentativas de religar. Curto: sem ligação a tela fica bloqueada, e cada tentativa é só
// abrir um WebSocket.
const RETRY_MS = [1000, 2000, 3000, 5000];
// Com o app na tela, a confirmação para o computador (que, sem ela, conta como fora da tela).
const VISIBLE_BEAT_MS = 10_000;
const CALL_TIMEOUT_MS = 30_000;
// A cada batida, com o app na tela, um pedido pequeno confere se a ligação ainda responde. Sem
// resposta nesse prazo, ela é dada como morta e religa. Trocando do Wi-Fi de casa para o 4G, a
// ligação morria sem aviso e o app seguia "conectado" sem receber nada (2026-11-14).
const PROBE_TIMEOUT_MS = 8000;
// Aperto de mão feito e o computador sem dar as boas-vindas nesse prazo: tenta de novo (antes ficava
// em "conectando" para sempre).
const WELCOME_TIMEOUT_MS = 15_000;

// Argus de casa mais antigo que o app: recusa o canal novo com "Canal X indisponível no celular".
const UNKNOWN_CHANNEL = /^(Canal \S+ indisponível no celular|Channel \S+ unavailable on the phone)\.?$/;

function friendlyError(error: string): string {
  return UNKNOWN_CHANNEL.test(error)
    ? tr('Isto precisa da versão mais nova do Argus no computador. Atualize o Argus por lá e tente de novo.', 'This needs the newest Argus on the computer. Update Argus there and try again.')
    : error;
}

export class HostConnection {
  status: ConnectionStatus = 'connecting';
  info: WebHostInfo | null = null;
  // Motivo do status, para a tela (versão diferente, por exemplo).
  detail: string | null = null;
  private link: Link | null = null;
  private ready = false;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Map<string, Set<Listener>>();
  private statusListeners = new Set<() => void>();
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private connecting = false;
  private visible = typeof document === 'undefined' || document.visibilityState === 'visible';
  private waiters: (() => void)[] = [];
  private beat: ReturnType<typeof setInterval> | null = null;
  private probing = false;
  // Ligações prontas até agora: cada uma nova faz as telas relerem (ver lib/host.tsx), mesmo quando o
  // status não passou por fora do ar (a volta do fundo).
  connections = 0;

  constructor(readonly host: PairedHost) {}

  start(): void {
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.link?.close();
  }

  onStatus(cb: () => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  private setStatus(status: ConnectionStatus, detail: string | null = null): void {
    this.status = status;
    this.detail = detail;
    for (const cb of this.statusListeners) cb();
  }

  private async connect(): Promise<void> {
    // No fundo não liga: quem olha é a notificação (ver pause).
    if (this.stopped || this.connecting || this.link || !this.visible) return;
    this.connecting = true;
    if (this.status !== 'online') this.setStatus('connecting');
    try {
      const raw = await openSocket(`${relayBase()}/client/${this.host.hostId}`);
      const link = await openSession(raw, this.host.deviceId, unb64(this.host.psk));
      this.link = link;
      // Recado atrasado de uma ligação já largada (ver lost) não vale para a nova.
      link.onMessage((d) => this.link === link && this.receive(d));
      link.onClose(() => this.dropped(link));
      this.post({ t: 'hello', protocol: WEB_PROTOCOL_VERSION });
      setTimeout(() => {
        if (this.link === link && !this.ready) this.lost(link);
      }, WELCOME_TIMEOUT_MS);
    } catch (err) {
      if (err instanceof HandshakeError && (err.reason === 'unknown-device' || err.reason === 'bad-key')) {
        this.setStatus('unpaired');
      } else {
        this.setStatus('offline');
        this.scheduleRetry();
      }
    } finally {
      this.connecting = false;
    }
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return;
    const delay = RETRY_MS[Math.min(this.attempts++, RETRY_MS.length - 1)];
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  // Voltou para a tela: religa na hora (o celular pode ter derrubado a ligação no fundo) e confere se
  // a que parece aberta ainda responde.
  wake(): void {
    if (this.stopped || this.status === 'unpaired' || this.status === 'kicked') return;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.attempts = 0;
    if (!this.link) return void this.connect();
    if (this.ready) this.probe(this.link);
  }

  // Confere se a ligação responde; sem resposta no prazo, larga ela e religa.
  private probe(link: Link): void {
    if (this.probing) return;
    this.probing = true;
    const id = this.nextId++;
    const done = () => {
      this.probing = false;
    };
    const timer = setTimeout(() => {
      this.pending.delete(id);
      done();
      if (this.link === link) this.lost(link);
    }, PROBE_TIMEOUT_MS);
    this.pending.set(id, { resolve: done, reject: done, timer });
    this.post({ t: 'call', id, ch: 'chat:active', args: [] });
  }

  // Ligação morta sem aviso: o fechamento dela pode demorar (o navegador espera a resposta do outro
  // lado), então a troca não espera por ele.
  private lost(link: Link): void {
    link.close();
    this.dropped(link);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (!on) return this.pause();
    if (this.ready) this.post({ t: 'visible', on: true });
    this.wake();
  }

  // App no fundo ou tela apagada: avisa o computador e fecha a ligação. O iPhone congela o app com a
  // ligação aberta, e o computador seguia achando que alguém olhava a tela: as notificações não
  // saíam. O status fica como estava (sem a camada de "sem conexão" ao voltar); ao voltar, liga de
  // novo (wake) e as telas releem.
  private pause(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const link = this.link;
    if (!link) return;
    if (this.ready) this.post({ t: 'visible', on: false });
    this.release(link);
    link.close();
  }

  private release(link: Link): void {
    if (this.link !== link) return;
    this.link = null;
    this.ready = false;
    this.stopBeat();
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(tr('A ligação com o computador caiu.', 'The connection to the computer dropped.')));
    }
    this.pending.clear();
  }

  private startBeat(): void {
    this.stopBeat();
    this.beat = setInterval(() => {
      if (!this.ready || !this.visible || !this.link) return;
      this.post({ t: 'visible', on: true });
      this.probe(this.link);
    }, VISIBLE_BEAT_MS);
  }

  private stopBeat(): void {
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
  }

  setPush(sub: WebPushSubscription | null): void {
    this.post({ t: 'push', sub });
  }

  private dropped(link: Link): void {
    if (this.link !== link) return;
    this.release(link);
    if (this.status === 'rejected' || this.status === 'kicked') return;
    this.setStatus('offline');
    this.scheduleRetry();
  }

  private post(m: WebClientMessage): void {
    this.link?.send(encodeWeb(m));
  }

  private receive(data: Uint8Array): void {
    const m = decodeWeb(data);
    if (!m) return;
    switch (m.t) {
      case 'welcome':
        this.info = m.info as WebHostInfo;
        this.ready = true;
        this.attempts = 0;
        this.post({ t: 'visible', on: this.visible });
        this.startBeat();
        this.connections++;
        this.setStatus('online');
        this.waiters.splice(0).forEach((w) => w());
        return;
      case 'reject':
        this.setStatus('rejected', typeof m.reason === 'string' ? m.reason : null);
        return;
      case 'bye':
        this.setStatus('kicked');
        return;
      case 'reply': {
        const p = this.pending.get(m.id as number);
        if (!p) return;
        this.pending.delete(m.id as number);
        clearTimeout(p.timer);
        if (m.ok) p.resolve(m.value);
        else p.reject(new Error(typeof m.error === 'string' ? friendlyError(m.error) : 'erro'));
        return;
      }
      case 'event': {
        const set = this.listeners.get(m.ch as string);
        if (set && Array.isArray(m.args)) for (const cb of set) (cb as (...a: unknown[]) => void)(...m.args);
        return;
      }
    }
  }

  // Espera a ligação ficar pronta (até o prazo do pedido).
  private whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(tr('Sem ligação com o computador.', 'No connection to the computer.'))), CALL_TIMEOUT_MS);
      this.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  // Um canal da lista liberada (WEB_CHANNELS). Os sem resposta também confirmam a entrega.
  async call<C extends WebChannel>(ch: C, ...args: Args<C>): Promise<Result<C>> {
    await this.whenReady();
    const id = this.nextId++;
    return new Promise<Result<C>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(tr('O computador não respondeu.', 'The computer did not answer.')));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.post({ t: 'call', id, ch, args: args as unknown[] });
    });
  }

  on<E extends keyof EventChannels>(event: E, cb: EventChannels[E]): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(cb as Listener);
    this.listeners.set(event, set);
    return () => set.delete(cb as Listener);
  }
}
