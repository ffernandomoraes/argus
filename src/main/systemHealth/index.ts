import type { DiskInfo, DiskLevel, HealthEvent, MemoryInfo, MemoryLevel, SystemHealthState } from '../../shared/systemHealth'

// Memória e disco do computador e o que teve de parar por falta deles, para o aviso da barra de
// cima: o ícone aparece chegando no limite, e o clique mostra os números e o que foi encerrado.
// Antes, a conversa fechada ou o Claude encerrado por falta de memória paravam sem explicação.

// De quanto em quanto tempo lê a memória e o disco.
const SAMPLE_MS = 30_000
// Os mais recentes, até você dar "Entendi".
const MAX_EVENTS = 20
// O disco cheio entra uma vez a cada tanto, não a cada gravação que falha.
const DISK_EVENT_GAP_MS = 10 * 60_000

export type NewHealthEvent = Omit<HealthEvent, 'id' | 'at'>

export type HealthReaders = {
  memory: (previous?: MemoryLevel) => Promise<MemoryInfo | null>
  disk: (previous?: DiskLevel) => Promise<DiskInfo | null>
}

// O que acontece antes de o vigia existir (a janela do canvas caindo na abertura) espera por ele.
let current: SystemHealth | null = null
const early: NewHealthEvent[] = []

export function recordHealthEvent(e: NewHealthEvent): void {
  if (current) current.record(e)
  else early.push(e)
}

export class SystemHealth {
  private state: SystemHealthState = { memory: null, disk: null, events: [], freed: [] }
  private timer: NodeJS.Timeout | null = null
  private shown = ''
  private seq = 0

  constructor(
    private readers: HealthReaders,
    private onChange: (state: SystemHealthState) => void,
    private now: () => number = Date.now
  ) {
    current = this
    early.splice(0).forEach((e) => this.record(e))
  }

  start(): void {
    void this.sample()
    this.timer = setInterval(() => void this.sample(), SAMPLE_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  get(): SystemHealthState {
    return this.state
  }

  // O aviso aberto: os números da hora (as janelas só recebem a mudança de nível; ver set).
  async read(): Promise<SystemHealthState> {
    await this.sample()
    return this.state
  }

  record(e: NewHealthEvent): void {
    const at = this.now()
    if (e.kind === 'diskFull') {
      void this.sample()
      if (this.state.events.some((x) => x.kind === 'diskFull' && at - x.at < DISK_EVENT_GAP_MS)) return
    }
    const event: HealthEvent = { ...e, id: `${at}-${++this.seq}`, at }
    const freed = e.kind === 'chatClosed' && e.sessionId && !this.state.freed.includes(e.sessionId) ? [...this.state.freed, e.sessionId] : this.state.freed
    this.set({ events: [...this.state.events, event].slice(-MAX_EVENTS), freed })
  }

  // A conversa voltou a trabalhar: a linha de "fechada para liberar memória" sai dela.
  reopened(sessionId: string | undefined): void {
    if (!sessionId || !this.state.freed.includes(sessionId)) return
    this.set({ freed: this.state.freed.filter((id) => id !== sessionId) })
  }

  // "Entendi" no aviso: o que aconteceu já foi visto.
  dismiss(): void {
    if (this.state.events.length) this.set({ events: [] })
  }

  private async sample(): Promise<void> {
    const [memory, disk] = await Promise.all([
      this.readers.memory(this.state.memory?.level).catch(() => null),
      this.readers.disk(this.state.disk?.level).catch(() => null)
    ])
    this.set({ memory, disk })
  }

  // Os números mudam a cada leitura; as janelas só ficam sabendo quando muda o nível, o que
  // aconteceu ou as conversas fechadas. Quem mostra os números (o aviso aberto) lê na hora.
  private set(patch: Partial<SystemHealthState>): void {
    this.state = { ...this.state, ...patch }
    const { memory, disk, events, freed } = this.state
    const signature = JSON.stringify([memory?.level ?? null, disk?.level ?? null, events.map((e) => e.id), freed])
    if (signature === this.shown) return
    this.shown = signature
    this.onChange(this.state)
  }
}
