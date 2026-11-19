import type { Usage } from '@argus/shared/usage';
import { createBackoff } from '../lib/backoff';
import { providerLaunch } from '../providers/env';
import { runCli } from '../providers/status';
import { antigravityUsage } from './antigravityParse';
import { ProviderUsageMonitors, type AccountUsageMonitor, type AccountUsageUpdate } from './providerMonitors';
import type { SavedUsages } from './saved';

// Limites da conta de login do Antigravity, pelo comando oficial `agy -p /usage`: quem responde é o
// próprio CLI, sem pedido ao modelo, sem gastar cota e sem criar conversa (conferido no agy 1.5.12).
// O Argus não lê o token nem chama o serviço da Google por fora. A leitura é espaçada (10 minutos)
// e acontece também logo depois de um pedido numa conversa da conta, quando o número muda. Conta
// por chave de API não tem esse limite: o comando responde sem números e ela não aparece.

const POLL_MS = 10 * 60_000;
// Depois de um pedido, espera o agy fechar a conta do uso antes de ler.
const AFTER_TURN_MS = 5_000;
const COMMAND = ['--output-format', 'json', '--print-timeout', '40s', '-p', '/usage'];

// Aviso das conversas (agentChats/acp.ts) para o monitor da conta, sem uma importar a outra.
let onTurn: (accountId: string) => void = () => {};
export const reportAntigravityTurn = (accountId: string) => onTurn(accountId);

class AntigravityUsageMonitor implements AccountUsageMonitor {
  private timer: NodeJS.Timeout | null = null;
  private reading = false;
  private stopped = false;
  // Muda a cada login trocado: a leitura que já estava no ar responde pela conta anterior.
  private gen = 0;
  // Leitura que falhou (sem internet): espera cada vez mais, até 1 hora.
  private backoff = createBackoff({ initialMs: POLL_MS, maxMs: 60 * 60_000 });
  last: Usage | null = null;

  constructor(
    private accountId: string,
    private onUpdate: AccountUsageUpdate,
  ) {}

  start(): void {
    void this.read();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  reread(): void {
    this.gen++;
    if (this.last) {
      this.last = null;
      this.onUpdate(null, true);
    }
    this.backoff.reset();
    this.schedule(0);
  }

  // Um pedido da conta terminou: o uso mudou.
  afterTurn(): void {
    this.schedule(AFTER_TURN_MS);
  }

  private schedule(wait: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    // Com uma leitura no ar, ela mesma marca a próxima ao terminar (ver read).
    this.timer = setTimeout(() => void this.read(), wait);
  }

  private async read(): Promise<void> {
    if (this.reading || this.stopped) return;
    const launch = providerLaunch('antigravity', COMMAND, this.accountId);
    if (!launch) return;
    this.reading = true;
    const gen = this.gen;
    const out = await runCli(launch, 60_000);
    this.reading = false;
    if (this.stopped) return;
    if (gen !== this.gen) return this.schedule(0);
    const usage = out.code === 0 ? antigravityUsage(out.stdout, Date.now()) : null;
    if (usage) {
      const had = !!this.last;
      this.last = usage;
      this.onUpdate(usage, had);
      this.backoff.reset();
    } else console.warn('[usage] antigravity: limites não lidos:', (out.stderr || out.stdout).trim().slice(0, 200));
    this.schedule(usage ? POLL_MS : this.backoff.next());
  }
}

// Um monitor por conta de login do Antigravity (ver providerMonitors.ts).
export class AntigravityUsageMonitors extends ProviderUsageMonitors<AntigravityUsageMonitor> {
  constructor(onUpdate: (account: string, usage: Usage | null) => void, saved: SavedUsages) {
    super('antigravity', (id, update) => new AntigravityUsageMonitor(id, update), onUpdate, saved);
    onTurn = (id) => this.get(id)?.afterTurn();
  }
}
