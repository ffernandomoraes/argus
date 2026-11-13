import { addRemotePage, removeRemotePage } from '../ipc/events';
import { dispatch } from '../ipc/register';
import { tr } from '../i18n';
import {
  decodeWeb,
  encodeWeb,
  WEB_CHANNELS,
  WEB_EVENTS,
  WEB_PROTOCOL_VERSION,
  type WebHostInfo,
  type WebHostMessage,
  type PushTestResult,
  type WebPushSubscription,
} from '@argus/shared/webRemote';
import type { Link } from './link';
import { RemotePage } from './remotePage';

// O lado do Argus de casa para um aparelho web (o app do celular): uma página remota só, que recebe
// os avisos da lista curta (WEB_EVENTS) e chama só os canais de WEB_CHANNELS, pelos mesmos handlers
// das janelas (ipc/register.ts `dispatch`).

const EVENTS = new Set<string>(WEB_EVENTS);
const CHANNELS: Record<string, 'invoke' | 'send' | 'sync' | undefined> = WEB_CHANNELS;

// Só os serviços de notificação dos navegadores (Apple, Google, Mozilla, Microsoft): o endereço
// vem do aparelho e é este computador que manda o pedido para ele.
const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

export function validPushSubscription(value: unknown): WebPushSubscription | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.endpoint !== 'string' || typeof v.p256dh !== 'string' || typeof v.auth !== 'string') return null;
  if (v.endpoint.length > 2048 || v.p256dh.length > 200 || v.auth.length > 100) return null;
  let url: URL;
  try {
    url = new URL(v.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.some((re) => re.test(url.hostname))) return null;
  return { endpoint: v.endpoint, p256dh: v.p256dh, auth: v.auth };
}

export type WebSessionHooks = {
  info: () => WebHostInfo
  // Notificações ligadas ou desligadas no aparelho.
  push: (sub: WebPushSubscription | null) => void
  // Manda uma notificação de teste para este aparelho.
  pushTest: () => Promise<PushTestResult>
  onEnd: () => void
};

// O estado de uma conversa chega a cada pedaço de texto (~50 ms), com a resposta inteira até ali:
// no celular vai no máximo a cada STATE_EVERY_MS, sempre o mais recente.
const STATE_EVERY_MS = 250;

export class WebHostSession {
  private page: RemotePage | null = null;
  private ended = false;
  // Conversas abertas na tela do celular (chat:retain): só delas vai o estado ao vivo.
  private held = new Map<string, number>();
  private stateTimers = new Map<string, { timer: NodeJS.Timeout; latest: unknown[] | null }>();
  // Com o app no fundo (ou a tela do celular apagada), o que acontece vira notificação.
  visible = true;

  constructor(
    private link: Link,
    private hooks: WebSessionHooks,
  ) {
    link.onMessage((data) => this.receive(data));
    link.onClose(() => this.end());
  }

  close(): void {
    this.link.close();
    this.end();
  }

  kick(): void {
    this.send({ t: 'bye' });
    this.close();
  }

  private send(message: WebHostMessage): void {
    if (this.ended) return;
    try {
      this.link.send(Buffer.from(encodeWeb(message)));
    } catch (err) {
      if (message.t === 'reply') this.link.send(Buffer.from(encodeWeb({ t: 'reply', id: message.id, ok: false, error: String(err) })));
      else console.error('[remoto web] aviso não enviado:', err);
    }
  }

  private receive(data: Buffer): void {
    const m = decodeWeb(data);
    if (!m) {
      console.warn('[remoto web] mensagem inválida; ligação encerrada');
      return this.close();
    }
    if (!this.page && m.t !== 'hello') return this.close();
    switch (m.t) {
      case 'hello':
        return this.hello(m.protocol);
      case 'call':
        if (!Number.isSafeInteger(m.id) || typeof m.ch !== 'string' || !Array.isArray(m.args)) return this.close();
        return void this.call(m.id as number, m.ch, m.args);
      case 'push':
        if (m.sub === null) return this.hooks.push(null);
        {
          const sub = validPushSubscription(m.sub);
          if (sub) this.hooks.push(sub);
        }
        return;
      case 'visible':
        this.visible = m.on === true;
        return;
      case 'pushTest':
        if (!Number.isSafeInteger(m.id)) return this.close();
        return void this.hooks.pushTest().then((value) => this.send({ t: 'reply', id: m.id as number, ok: true, value }));
      default:
        return this.close();
    }
  }

  private hello(protocol: unknown): void {
    if (this.page) return;
    const info = this.hooks.info();
    if (protocol !== WEB_PROTOCOL_VERSION) {
      this.send({
        t: 'reject',
        reason: tr(
          `O Argus de ${info.name} (${info.version}) não conversa com esta versão do app. Atualize o Argus de lá e recarregue esta página.`,
          `The Argus on ${info.name} (${info.version}) can't talk to this version of the app. Update that Argus and reload this page.`,
        ),
      });
      return this.close();
    }
    this.page = new RemotePage((ch, args) => {
      if (!EVENTS.has(ch)) return;
      if (ch === 'chat:state') return this.chatState(args);
      this.send({ t: 'event', ch, args });
    });
    addRemotePage(this.page);
    this.send({ t: 'welcome', info });
  }

  private chatState(args: unknown[]): void {
    const key = args[0];
    if (typeof key !== 'string' || !this.held.has(key)) return;
    const pending = this.stateTimers.get(key);
    if (pending) {
      pending.latest = args;
      return;
    }
    this.send({ t: 'event', ch: 'chat:state', args });
    const entry = {
      latest: null as unknown[] | null,
      timer: setTimeout(() => {
        this.stateTimers.delete(key);
        if (entry.latest) this.chatState(entry.latest);
      }, STATE_EVERY_MS),
    };
    this.stateTimers.set(key, entry);
  }

  private track(ch: string, args: unknown[]): void {
    const key = args[0];
    if (typeof key !== 'string') return;
    if (ch === 'chat:retain') this.held.set(key, (this.held.get(key) ?? 0) + 1);
    else if (ch === 'chat:release') {
      const n = (this.held.get(key) ?? 1) - 1;
      if (n <= 0) this.held.delete(key);
      else this.held.set(key, n);
    }
  }

  private async call(id: number, ch: string, args: unknown[]): Promise<void> {
    const kind = CHANNELS[ch];
    if (kind) this.track(ch, args);
    try {
      if (!kind || !this.page) throw new Error(tr(`Canal ${ch} indisponível no celular.`, `Channel ${ch} unavailable on the phone.`));
      const value = await dispatch(kind, ch, { sender: this.page }, args);
      this.send({ t: 'reply', id, ok: true, value: value ?? null });
    } catch (err) {
      this.send({ t: 'reply', id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    for (const { timer } of this.stateTimers.values()) clearTimeout(timer);
    this.stateTimers.clear();
    if (this.page) {
      removeRemotePage(this.page);
      this.page.destroy();
      this.page = null;
    }
    this.hooks.onEnd();
  }
}
