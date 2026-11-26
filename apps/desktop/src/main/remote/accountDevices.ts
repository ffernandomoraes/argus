import type { DeviceKind } from '@argus/shared/webRemote';
import { AccountHttpError } from '../account/http';
import { note } from '../diagnostics/journal';
import type { AccountBridge } from './accountRemote';
import { HandshakeError, type Grant, type PairGrant } from './handshake';
import type { Link } from './link';
import type { PairedDevice } from './store';

// Aparelhos pareados pela conta do Argus, no computador de casa. O pareamento pela conta fica preso à
// sessão da conta de quem pareou (o bilhete trocado no pareamento, ver apps/account remote.tickets.ts):
// - cada entrada desse aparelho confere na conta se a sessão ainda vale. Não vale mais (saiu da conta,
//   foi tirado em Perfil > Aparelhos, venceu): o pareamento sai e a ligação cai;
// - a conta avisa na hora quando um aparelho sai (evento "device-removed" do fluxo de avisos), e a
//   lista é conferida de novo a cada 10 minutos e quando o fluxo religa;
// - remover o aparelho aqui (Acesso remoto) tira também a sessão dele da conta: ele não pareia de novo
//   pela conta sem entrar nela de novo;
// - a conta saiu deste computador: os pareados por ela saem todos.
// Sem resposta da conta (sem internet, servidor fora do ar), a entrada vale: só um "não vale mais" da
// conta tira o pareamento. Sem a conta aberta neste computador, quem entrou por ela não entra.

const CHECK_EVERY_MS = 10 * 60_000;
const MAX_CHECK = 200;

export type AccountDevicesDeps = {
  bridge(): AccountBridge | null
  devices(): PairedDevice[]
  // Tira o pareamento e derruba as ligações dele, sem falar com a conta.
  drop(deviceId: string): void
  // Sessões de aparelhos removidos aqui que ainda falta tirar da conta (guardadas com os pareamentos).
  removals: { get(): string[]; set(list: string[]): void }
};

export type CreateDevice = (name: string, psk: Buffer, kind: DeviceKind, accountSession: string) => PairGrant;

export class AccountDevices {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: AccountDevicesDeps) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.sweep(), CHECK_EVERY_MS);
    this.timer.unref?.();
    void this.sweep();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // O grant da vaga da conta: sem bilhete válido, ninguém entra; com ele, o aparelho fica preso à
  // sessão de quem pediu o bilhete.
  grant(create: CreateDevice): Grant {
    return async (name, psk, kind, ticket) => {
      const bridge = this.deps.bridge();
      if (!ticket || !bridge) throw new HandshakeError('invalid');
      const r = await bridge.request<{ sessionId?: unknown }>('/api/remote/claim', 'POST', { ticket }).catch((err: unknown) => {
        note('remote', 'pareamento pela conta: bilhete não trocado', { error: err instanceof Error ? err.message.slice(0, 80) : 'erro' });
        return null;
      });
      const session = typeof r?.sessionId === 'string' ? r.sessionId : null;
      if (!session || this.deps.removals.get().includes(session)) throw new HandshakeError('invalid');
      note('remote', 'pareado pela conta', { kind, name: name.slice(0, 40) });
      return create(name, psk, kind, session);
    };
  }

  // Uma ligação nova de um aparelho pareado pela conta pode entrar? A conta disse que a sessão dele
  // não vale mais: o pareamento sai. Sem a conta aberta aqui, não entra, mas o pareamento fica (a conta
  // pode estar só carregando, logo depois de abrir o app).
  async allow(device: PairedDevice): Promise<boolean> {
    const session = device.accountSession;
    if (!session) return true;
    if (!this.deps.bridge()) {
      note('remote', 'aparelho da conta recusado: conta não aberta neste computador', { kind: device.kind });
      return false;
    }
    const alive = await this.alive([session], [session]);
    if (!alive) note('remote', 'conta não respondeu à conferência: aparelho entra assim mesmo', { kind: device.kind });
    if (!alive || alive.includes(session)) return true;
    note('remote', 'aparelho da conta recusado: sessão não vale mais, pareamento removido', { kind: device.kind });
    this.deps.drop(device.id);
    return false;
  }

  // Como allow, para a ligação que acabou de entrar: se ela fechar durante a conferência, não segue.
  async allowLink(device: PairedDevice, link: Link): Promise<boolean> {
    if (!device.accountSession) return true;
    let closed = false;
    link.onClose(() => (closed = true));
    const allowed = await this.allow(device);
    if (allowed && closed) note('remote', 'ligação caiu durante a conferência na conta', { kind: device.kind });
    return allowed && !closed;
  }

  // Confere todos os pareados pela conta e manda de novo as remoções que ficaram pendentes.
  async sweep(): Promise<void> {
    await this.flushRemovals();
    const bound = this.deps.devices().filter((d) => d.accountSession);
    for (let i = 0; i < bound.length; i += MAX_CHECK) {
      const part = bound.slice(i, i + MAX_CHECK);
      const alive = await this.alive(
        part.map((d) => d.accountSession!),
        [],
      );
      if (!alive) return;
      for (const d of part) if (!alive.includes(d.accountSession!)) this.deps.drop(d.id);
    }
  }

  // A conta avisou que esta sessão saiu.
  removed(sessionId: string): void {
    for (const d of this.deps.devices()) if (d.accountSession === sessionId) this.deps.drop(d.id);
  }

  // A conta saiu deste computador.
  gone(): void {
    for (const d of this.deps.devices()) if (d.accountSession) this.deps.drop(d.id);
  }

  // Removido aqui: a sessão dele sai da conta também (ou fica pendente, sem internet agora).
  forget(device: PairedDevice): void {
    if (!device.accountSession) return;
    this.deps.removals.set([...new Set([...this.deps.removals.get(), device.accountSession])]);
    void this.flushRemovals();
  }

  private async flushRemovals(): Promise<void> {
    const bridge = this.deps.bridge();
    const pending = this.deps.removals.get();
    if (!bridge || !pending.length) return;
    const done: string[] = [];
    for (const id of pending) {
      try {
        await bridge.request(`/api/devices/${encodeURIComponent(id)}`, 'DELETE');
        done.push(id);
      } catch (err) {
        // 404: já não estava na conta.
        if (err instanceof AccountHttpError && err.status === 404) done.push(id);
      }
    }
    if (done.length) this.deps.removals.set(this.deps.removals.get().filter((id) => !done.includes(id)));
  }

  // As sessões que ainda valem. Nulo: sem resposta da conta.
  private async alive(ids: string[], seen: string[]): Promise<string[] | null> {
    const bridge = this.deps.bridge();
    if (!bridge) return null;
    try {
      const r = await bridge.request<{ alive?: unknown }>('/api/remote/check', 'POST', { ids, seen });
      return Array.isArray(r?.alive) ? r.alive.filter((s): s is string => typeof s === 'string') : null;
    } catch (err) {
      note('remote', 'conferência na conta falhou', { error: err instanceof Error ? err.message.slice(0, 80) : 'erro' });
      return null;
    }
  }
}
