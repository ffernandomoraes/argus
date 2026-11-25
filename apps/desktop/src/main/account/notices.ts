import { accountUrl, AccountHttpError } from './http';

// Avisos entre os computadores da conta: uma conversa terminou (ou precisa de você, ou deu erro)
// neste computador sem ninguém na frente, e o aviso aparece nos outros computadores da conta que
// estão ligados. Daqui sai o aviso (POST /api/notices) e aqui chegam os dos outros, pelo fluxo
// GET /api/notices/stream (Server-Sent Events). O servidor só repassa.

export type IncomingNotice = { from: string; title: string; body: string; kind: string; hostId?: string };

// Sem ninguém mexendo no computador por este tempo (ou com a tela bloqueada), o aviso vai para os
// outros computadores.
export const AWAY_SECONDS = 180;

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;
// Um aviso tem bem menos que isso: um bloco maior (ou um fluxo que nunca fecha o bloco) derruba a
// ligação, que volta mais tarde.
export const MAX_EVENT_CHARS = 64 * 1024;

const HOST_ID = /^[\w-]{1,128}$/;

function readNotice(data: string): IncomingNotice | null {
  try {
    const v = JSON.parse(data) as Partial<IncomingNotice>;
    if (typeof v.title !== 'string' || typeof v.from !== 'string') return null;
    return {
      from: v.from.slice(0, 64),
      title: v.title.slice(0, 300),
      body: typeof v.body === 'string' ? v.body.slice(0, 600) : '',
      kind: typeof v.kind === 'string' ? v.kind.slice(0, 32) : 'done',
      ...(typeof v.hostId === 'string' && HOST_ID.test(v.hostId) && { hostId: v.hostId }),
    };
  } catch {
    return null;
  }
}

// Os blocos "event: ...\ndata: ..." do fluxo, um aviso por bloco, ou um aparelho que saiu da conta
// ("device-removed", com o id da sessão dele). Devolve o que sobrou (bloco ainda chegando). Sobra maior
// que MAX_EVENT_CHARS: erro (a ligação cai e volta depois).
export function parseEvents(buffer: string, onNotice: (n: IncomingNotice) => void, onDeviceRemoved?: (sessionId: string) => void): string {
  let rest = buffer;
  let end: number;
  while ((end = rest.indexOf('\n\n')) >= 0) {
    const block = rest.slice(0, end);
    rest = rest.slice(end + 2);
    const lines = block.split('\n');
    const data = lines.find((l) => l.startsWith('data: '));
    if (lines.includes('event: device-removed')) {
      const id = data ? removedId(data.slice(6)) : null;
      if (id) onDeviceRemoved?.(id);
      continue;
    }
    if (!lines.includes('event: notice')) continue;
    const notice = data ? readNotice(data.slice(6)) : null;
    if (notice) onNotice(notice);
  }
  if (rest.length > MAX_EVENT_CHARS) throw new Error('notice event too large');
  return rest;
}

function removedId(json: string): string | null {
  try {
    const v = JSON.parse(json) as { id?: unknown };
    return typeof v.id === 'string' && v.id.length <= 100 ? v.id : null;
  } catch {
    return null;
  }
}

export type NoticeHandlers = {
  notice(n: IncomingNotice): void
  // Um aparelho saiu da conta (sessão `sessionId`).
  deviceRemoved(sessionId: string): void
  // O fluxo abriu (ou religou): o que aconteceu enquanto estava fechado não chegou.
  opened(): void
  // A conta não reconhece mais esta sessão (saiu por outro aparelho).
  unauthorized(): void
};

// O fluxo aberto enquanto a conta estiver aberta neste computador, religando sozinho.
export class NoticeStream {
  private controller: AbortController | null = null;
  private timer: NodeJS.Timeout | null = null;
  private retry = RETRY_MIN_MS;

  constructor(private readonly on: NoticeHandlers) {}

  start(token: string): void {
    this.stop();
    void this.run(token);
  }

  stop(): void {
    this.controller?.abort();
    this.controller = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async run(token: string): Promise<void> {
    const controller = new AbortController();
    this.controller = controller;
    try {
      const res = await fetch(`${accountUrl()}/api/notices/stream`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal });
      if (res.status === 401) {
        this.controller = null;
        return this.on.unauthorized();
      }
      if (!res.ok || !res.body) throw new AccountHttpError(res.status, 'notices stream');
      this.retry = RETRY_MIN_MS;
      this.on.opened();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = parseEvents(buffer + decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n'), this.on.notice, this.on.deviceRemoved);
      }
    } catch {
      // Sem rede, servidor reiniciando ou parado de propósito: religa abaixo (se não foi parado).
    }
    if (this.controller !== controller) return;
    // Solta a ligação que ficou aberta (bloco grande demais, por exemplo).
    controller.abort();
    this.controller = null;
    this.timer = setTimeout(() => void this.run(token), this.retry);
    this.timer.unref?.();
    this.retry = Math.min(this.retry * 2, RETRY_MAX_MS);
  }
}
