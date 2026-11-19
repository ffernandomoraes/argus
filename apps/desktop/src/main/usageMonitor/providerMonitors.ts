import { agentRef, type ProviderAccountStatus, type ProviderId } from '@argus/shared/providers';
import type { Usage } from '@argus/shared/usage';
import type { SavedUsages } from './saved';

// O monitor de uma conta: lê os limites dela de tempos em tempos e avisa a cada leitura.
export interface AccountUsageMonitor {
  // O último uso lido; nulo enquanto não há leitura (ou a conta não tem limite).
  last: Usage | null
  start(): void
  stop(): void
  // Login trocado: o que se sabia era da conta anterior, e sai da tela até a leitura do novo.
  reread(): void
}

// had: havia uso à vista antes deste aviso.
export type AccountUsageUpdate = (usage: Usage | null, had: boolean) => void;

// Um monitor por conta logada de um agente (Codex, Antigravity), na mesma chave das conversas
// ("codex:<id>"). O último uso de cada uma fica guardado (ver saved.ts) e só aparece depois de o
// login dela ser conferido com o mesmo e-mail: o app nunca lê o login do agente por fora.
export class ProviderUsageMonitors<M extends AccountUsageMonitor> {
  private monitors = new Map<string, M>();
  // E-mail do login conferido de cada conta, guardado junto com o uso lido.
  private emails = new Map<string, string | undefined>();
  private closed = false;

  constructor(
    private provider: ProviderId,
    private create: (accountId: string, onUpdate: AccountUsageUpdate) => M,
    private onUpdate: (account: string, usage: Usage | null) => void,
    private saved: SavedUsages,
  ) {}

  get(id: string): M | undefined {
    return this.monitors.get(id);
  }

  // Cada conferência de login das contas do agente. Sem status (não deu para conferir), a conta fica
  // como estava.
  sync(accounts: { id: string; status: ProviderAccountStatus | null }[]): void {
    if (this.closed) return;
    const ids = new Set(accounts.map((a) => agentRef(this.provider, a.id)));
    for (const key of this.saved.keys()) if (key.startsWith(`${this.provider}:`) && !ids.has(key)) this.forgetSaved(key);
    for (const { id, status } of accounts) {
      if (!status) continue;
      const key = agentRef(this.provider, id);
      const email = status.signedIn ? status.email : undefined;
      // Login trocado por fora (no terminal): o que estava na tela era da conta anterior.
      const changed = this.emails.has(id) && this.emails.get(id) !== email;
      this.emails.set(id, email);
      if (changed && status.signedIn) this.monitors.get(id)?.reread();
      const change = this.saved.confirm(key, status);
      if (change && !this.monitors.get(id)?.last) this.onUpdate(key, change === 'shown' ? this.saved.get(key) : null);
    }

    const signedIn = accounts.filter((a) => a.status?.signedIn).map((a) => a.id);
    for (const [id, monitor] of this.monitors) if (!signedIn.includes(id)) this.drop(id, monitor);
    for (const id of signedIn) {
      if (this.monitors.has(id)) continue;
      const key = agentRef(this.provider, id);
      const monitor = this.create(id, (usage, had) => {
        if (usage) {
          this.saved.remember(key, usage, this.emails.get(id));
          this.onUpdate(key, usage);
          return;
        }
        // Sem limite agora: some o que estava à vista, inclusive o guardado. Sem nada antes, nada a avisar.
        if (this.saved.forget(key) || had) this.onUpdate(key, null);
      });
      this.monitors.set(id, monitor);
      monitor.start();
    }
  }

  // Login trocado: o guardado era do login anterior.
  reread(id: string): void {
    const key = agentRef(this.provider, id);
    this.emails.delete(id);
    this.forgetSaved(key);
    this.monitors.get(id)?.reread();
  }

  private drop(id: string, monitor: M): void {
    monitor.stop();
    this.monitors.delete(id);
    const key = agentRef(this.provider, id);
    if (this.saved.forget(key) || monitor.last) this.onUpdate(key, null);
  }

  private forgetSaved(key: string): void {
    if (this.saved.forget(key)) this.onUpdate(key, null);
  }

  all(): Record<string, Usage> {
    const out: Record<string, Usage> = {};
    for (const [id, monitor] of this.monitors) if (monitor.last) out[agentRef(this.provider, id)] = monitor.last;
    return out;
  }

  stop(): void {
    this.closed = true;
    this.monitors.forEach((m) => m.stop());
    this.monitors.clear();
  }
}
