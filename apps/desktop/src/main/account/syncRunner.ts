import {
  afterPush,
  emptyMemory,
  isMainKey,
  isRendererKey,
  markDirty,
  missingOnServer,
  pendingValues,
  planPull,
  readReport,
  rendererValues,
  serverKey,
  type MainSyncValues,
  type RendererSyncValues,
  type SyncKey,
  type SyncMemory,
  type SyncValues,
} from '@argus/shared/accountSync';
import { accountRequest } from './http';

// Busca e envia as preferências da conta (as regras estão em packages/shared/src/accountSync.ts).
// Uma rodada por vez: pedida no meio de outra, roda de novo logo depois.

export type SyncRunnerDeps = {
  token(): string | null
  readMain(): MainSyncValues
  applyMain(values: MainSyncValues): void
  // Para as janelas aplicarem as delas.
  applyRenderer(values: RendererSyncValues): void
  saveMemory(memory: SyncMemory): void
};

type SyncResponse = { items: { key: string; value: unknown }[]; version: number };

export class SyncRunner {
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private memory: SyncMemory,
    private readonly deps: SyncRunnerDeps,
  ) {}

  get hasPending(): boolean {
    return this.memory.dirty.length > 0;
  }

  // Saiu da conta: esquece o combinado, mas guarda o que a janela contou.
  reset(): void {
    this.memory = emptyMemory(this.memory.rendererSeen);
    this.deps.saveMemory(this.memory);
  }

  // A janela contou as preferências dela. Fora da conta, só guarda o que ela tem.
  report(prefs: RendererSyncValues, signedIn: boolean): void {
    const r = readReport(this.memory, prefs);
    this.memory = signedIn ? markDirty(r.memory, r.edited) : r.memory;
    this.deps.saveMemory(this.memory);
    if (signedIn && Object.keys(r.toApply).length) this.deps.applyRenderer(r.toApply);
  }

  // Mudou uma preferência do processo principal (nas Configurações).
  mainChanged(): void {
    this.memory = markDirty(this.memory, this.deps.readMain());
    this.deps.saveMemory(this.memory);
  }

  // Primeira rodada depois de entrar: as da conta vencem; as que ela não tem vão daqui.
  // adopted: havia preferências na conta; uploaded: este é o primeiro computador dela.
  async adopt(): Promise<'adopted' | 'uploaded'> {
    this.memory = emptyMemory(this.memory.rendererSeen);
    const received = await this.pull(true);
    this.memory = markDirty(this.memory, missingOnServer(this.memory, this.current()));
    await this.push();
    this.deps.saveMemory(this.memory);
    return received > 0 ? 'adopted' : 'uploaded';
  }

  // Busca o que mudou na conta e envia o que mudou aqui. O erro (sem rede, sessão encerrada) sobe.
  run(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.pull(false);
          await this.push();
        } while (this.again);
      } finally {
        this.running = null;
        this.deps.saveMemory(this.memory);
      }
    })();
    return this.running;
  }

  private current(): SyncValues {
    return { ...rendererValues(this.memory), ...this.deps.readMain() };
  }

  private async pull(adopt: boolean): Promise<number> {
    const token = this.deps.token();
    if (!token) return 0;
    const since = adopt ? 0 : this.memory.cursor;
    const r = await accountRequest<SyncResponse>(`/api/sync?since=${since}`, { token });
    if (!r || !Array.isArray(r.items)) return 0;
    const plan = planPull(this.memory, r.items, Number(r.version) || 0, adopt);
    this.memory = plan.memory;
    const main: MainSyncValues = {};
    const renderer: RendererSyncValues = {};
    for (const [k, v] of Object.entries(plan.apply) as [SyncKey, unknown][]) {
      if (isMainKey(k)) main[k] = v;
      else if (isRendererKey(k)) renderer[k] = v;
    }
    if (Object.keys(main).length) this.deps.applyMain(main);
    if (Object.keys(renderer).length) this.deps.applyRenderer(renderer);
    return r.items.length;
  }

  private async push(): Promise<void> {
    const token = this.deps.token();
    if (!token || !this.memory.dirty.length) return;
    const sent = pendingValues(this.memory, this.current());
    const keys = Object.keys(sent) as SyncKey[];
    if (!keys.length) return;
    const items = Object.fromEntries(keys.map((k) => [serverKey(k), sent[k]]));
    await accountRequest('/api/sync', { method: 'PUT', token, body: { items } });
    this.memory = afterPush(this.memory, sent, this.current());
  }
}
