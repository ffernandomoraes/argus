import type { AccountRemoteHost, RemotePairResult } from '@argus/shared/remote';
import { AccountDevices, type AccountDevicesDeps, type CreateDevice } from './accountDevices';
import { AccountSlot, listAccountHosts, openFromAccount, type AccountBridge } from './accountRemote';

// O lado da conta do Argus no acesso remoto deste computador: a conta aberta (o caminho até o servidor
// dela), a vaga sempre aberta para os aparelhos da conta (accountRemote.ts) e os aparelhos pareados
// por ela, presos à sessão de cada um (accountDevices.ts).

type Deps = Omit<AccountDevicesDeps, 'bridge'> & {
  hostId(): string
  // A vaga só abre com o acesso ligado (a ponte de pé).
  hosting(): boolean
  create: CreateDevice
  changed(): void
};

export type AccountPairOps = {
  pair(code: string, ticket?: string): Promise<RemotePairResult>
  open(hostId: string): Promise<string | null>
};

export class AccountHosting {
  private bridge: AccountBridge | null = null;
  private slot: AccountSlot | null = null;
  readonly devices: AccountDevices;

  constructor(private readonly deps: Deps) {
    this.devices = new AccountDevices({ ...deps, bridge: () => this.bridge });
  }

  state(): 'signedOut' | 'on' | 'off' {
    if (!this.bridge) return 'signedOut';
    return this.slot ? 'on' : 'off';
  }

  // A conta abriu ou fechou neste computador (nula: fechou). Falso: nada mudou.
  setAccount(bridge: AccountBridge | null): boolean {
    if (bridge === this.bridge) return false;
    this.slot?.stop(false);
    this.slot = null;
    this.bridge = bridge;
    this.sync();
    return true;
  }

  // A vaga fica aberta só com o acesso ligado e a conta aberta; a conferência dos pareados pela conta
  // roda junto.
  sync(): void {
    const want = this.deps.hosting() && !!this.bridge;
    if (want && !this.slot && this.bridge) {
      this.slot = new AccountSlot(this.deps.hostId(), this.bridge, this.devices.grant(this.deps.create), () => this.deps.changed());
      this.slot.start();
      this.devices.start();
    } else if (!want && this.slot) {
      this.slot.stop(true);
      this.slot = null;
      this.devices.stop();
    }
  }

  // A sala deste computador, se os aparelhos da conta conseguem entrar nele agora.
  hostId(): string | null {
    return this.slot ? this.deps.hostId() : null;
  }

  // Os outros computadores da conta com o acesso ligado. Nulo: sem conta ou sem resposta.
  hosts(): Promise<AccountRemoteHost[] | null> {
    return this.bridge ? listAccountHosts(this.bridge) : Promise.resolve(null);
  }

  // Pareia com um computador da conta (com o bilhete dela) e abre a janela dele.
  open(hostId: string, ops: AccountPairOps): Promise<string | null> {
    return openFromAccount(this.bridge, hostId, ops);
  }

  shutdown(): void {
    this.slot?.stop(false);
    this.devices.stop();
  }
}
