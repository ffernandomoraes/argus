import type { AccountRemoteHost, RemotePairResult } from '@argus/shared/remote';
import { tr } from '../i18n';
import { formatPairCode, newPairCode } from './crypto';
import { pairAsHost, PAIR_WAIT_MS, type PairGrant } from './handshake';
import type { Link } from './link';
import { connectPairing, RelayError } from './relay';

// Acesso remoto pela conta do Argus: com "Permitir acesso" ligado e a conta aberta, o computador de
// casa mantém um código de pareamento sempre aberto na ponte e publica esse código na conta
// (apps/account, módulo remote). Os outros aparelhos da mesma conta pegam o código e pareiam sem
// digitar nada; depois disso tudo segue como no pareamento por código, cifrado de ponta a ponta
// (o servidor da conta entrega o código, mas não participa da ligação).

export type AccountBridge = {
  request<T>(path: string, method?: 'GET' | 'PUT' | 'POST' | 'DELETE', body?: unknown): Promise<T | null>
};

type Grant = Parameters<typeof pairAsHost>[2];

// O código é renovado um pouco antes de a vaga na ponte vencer: quem pegou o código antigo da conta
// ainda tem tempo de entrar.
const RENEW_MS = PAIR_WAIT_MS - 60_000;
// Sem ponte ou sem conta (internet caiu): tenta de novo depois disto.
const RETRY_MS = 30_000;

// No computador de casa: a vaga aberta para os aparelhos da conta, renovada sozinha.
export class AccountSlot {
  private running = false;
  private link: Link | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly hostId: string,
    private readonly bridge: AccountBridge,
    private readonly grant: Grant,
    private readonly onPaired: (granted: PairGrant) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.cycle();
  }

  // Para e tira o computador da lista da conta (sem a conta, a sessão já saiu e o registro junto).
  stop(unpublish: boolean): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.link?.close();
    this.link = null;
    if (unpublish) void this.bridge.request('/api/remote/host', 'DELETE').catch(() => {});
  }

  private later(ms: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => void this.cycle(), ms);
    this.timer.unref?.();
  }

  // Uma vaga: abre na ponte, publica o código na conta e espera alguém entrar ou o prazo acabar.
  private async cycle(): Promise<void> {
    this.timer = null;
    if (!this.running) return;
    const code = newPairCode();
    let link: Link;
    try {
      link = await connectPairing(code.nameplate, 'host');
    } catch (err) {
      // Vaga ocupada: outro código na hora; sem ponte, mais tarde.
      return this.later(err instanceof RelayError && err.reason === 'taken' ? 0 : RETRY_MS);
    }
    if (!this.running) return void link.close();
    this.link = link;
    const expiresAt = Date.now() + RENEW_MS;
    try {
      await this.bridge.request('/api/remote/host', 'PUT', { hostId: this.hostId, code: formatPairCode(code), expiresAt });
    } catch (err) {
      console.warn('[remoto] não deu para publicar o código na conta:', err instanceof Error ? err.message : err);
      link.close();
      this.link = null;
      return this.later(RETRY_MS);
    }
    const renew = setTimeout(() => link.close(), RENEW_MS);
    try {
      this.onPaired(await pairAsHost(link, code, this.grant));
    } catch {
      // Vencida (fechada pelo prazo), parada ou um pareamento que falhou: segue com outra vaga, com
      // uma pausa curta (quem tenta códigos errados não faz a vaga girar sem parar).
    } finally {
      clearTimeout(renew);
      link.close();
      if (this.link === link) this.link = null;
    }
    this.later(1000);
  }
}

type RawHost = { id?: unknown; hostId?: unknown; name?: unknown; platform?: unknown; code?: unknown };

// Os outros computadores da conta com acesso remoto ligado. O código fica só aqui no processo
// principal: a janela recebe a lista sem ele.
export async function fetchAccountHosts(bridge: AccountBridge): Promise<(AccountRemoteHost & { code: string | null })[]> {
  const r = await bridge.request<{ hosts?: RawHost[] }>('/api/remote/hosts');
  return (r?.hosts ?? []).flatMap((h) =>
    typeof h.hostId === 'string' && typeof h.id === 'string'
      ? [
          {
            hostId: h.hostId,
            name: typeof h.name === 'string' ? h.name : 'Argus',
            platform: typeof h.platform === 'string' ? h.platform : 'other',
            available: typeof h.code === 'string',
            code: typeof h.code === 'string' ? h.code : null,
          },
        ]
      : [],
  );
}

// A lista para a janela, sem os códigos. Nula: sem resposta da conta.
export function listAccountHosts(bridge: AccountBridge): Promise<AccountRemoteHost[] | null> {
  return fetchAccountHosts(bridge).then(
    (list) => list.map(({ code: _code, ...h }) => h),
    () => null,
  );
}

// O bilhete da conta para parear com `hostId`: vai junto no pareamento e prende o pareamento à sessão
// da conta deste aparelho (ver accountDevices.ts). Nulo: a conta não deu.
async function pairTicket(bridge: AccountBridge, hostId: string): Promise<string | null> {
  const r = await bridge.request<{ ticket?: unknown }>('/api/remote/ticket', 'POST', { hostId }).catch(() => null);
  return typeof r?.ticket === 'string' ? r.ticket : null;
}

// No notebook: pareia com o código que o computador publicou na conta (com o bilhete) e abre a
// janela. O código pode ter acabado de ser trocado lá: tenta uma segunda vez com o novo.
export async function openFromAccount(
  bridge: AccountBridge | null,
  hostId: string,
  ops: { pair: (code: string, ticket?: string) => Promise<RemotePairResult>; open: (hostId: string) => Promise<string | null> },
): Promise<string | null> {
  if (!bridge) return tr('Entre na conta do Argus de novo.', 'Sign in to your Argus account again.');
  let error = tr('Esse computador não está aceitando conexões agora.', 'That computer is not accepting connections right now.');
  for (let attempt = 0; attempt < 2; attempt++) {
    const host = await fetchAccountHosts(bridge).then((list) => list.find((h) => h.hostId === hostId), () => undefined);
    if (!host?.code) return error;
    const ticket = await pairTicket(bridge, hostId);
    if (!ticket) return error;
    const result = await ops.pair(host.code, ticket);
    if (result.ok) return ops.open(result.hostId);
    error = result.error;
  }
  return error;
}
