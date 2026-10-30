import { STORAGE_DEFAULTS, withMediaCap, type CleanResult, type StorageSettings, type StorageUsage } from '../../shared/storage'
import { loadAppSettings, saveAppSettings } from '../appSettings'
import { conversationDays, ensureConversationDays, setConversationDays } from './retention'
import { cleanScratch, scratchUsage } from './scratch'
import { conversationsUsage, trimConversations } from './transcripts'

// Limpeza do que o uso acumula no disco: os rascunhos do agente das conversas paradas e os prints
// das conversas antigas (o texto fica). Roda sozinha um pouco depois de abrir o app e uma vez por
// dia; a aba Armazenamento mostra quanto ocupa, muda os prazos e limpa na hora. A conversa inteira
// quem apaga é o próprio Claude Code, no prazo que a aba grava no settings.json dele (retention.ts).

// Depois de abrir: o app já está de pé e a limpeza não disputa com a abertura.
const FIRST_RUN_MS = 2 * 60_000
const CHECK_MS = 60 * 60_000
const EVERY_MS = 24 * 60 * 60_000
// A medida dos rascunhos (o du de milhões de arquivos) vale por este tempo.
const SCRATCH_CACHE_MS = 5 * 60_000

export class StorageCleaner {
  private first: NodeJS.Timeout | null = null
  private timer: NodeJS.Timeout | null = null
  private running: Promise<CleanResult> | null = null
  private scratch: { bytes: number; sessions: number; at: number } | null = null
  private measuring: Promise<void> | null = null

  // live: as sessões com o `claude` rodando agora (as delas não são tocadas).
  constructor(private live: () => Promise<ReadonlySet<string>>) {}

  start(): void {
    // Já na abertura: o primeiro `claude` que abrir (o do uso, uma conversa) apagaria as conversas
    // com mais de 30 dias, o padrão dele, antes de o do Argus valer.
    ensureConversationDays(STORAGE_DEFAULTS.conversationDays)
    this.first = setTimeout(() => void this.runIfDue(), FIRST_RUN_MS)
    this.timer = setInterval(() => void this.runIfDue(), CHECK_MS)
  }

  stop(): void {
    if (this.first) clearTimeout(this.first)
    if (this.timer) clearInterval(this.timer)
    this.first = this.timer = null
  }

  settings(): StorageSettings {
    // O prazo das conversas pode ter mudado no settings.json do Claude Code: o dos prints acompanha.
    return withMediaCap({ ...STORAGE_DEFAULTS, ...loadAppSettings().storage, conversationDays: conversationDays() ?? STORAGE_DEFAULTS.conversationDays })
  }

  setSettings(patch: Partial<StorageSettings>): StorageSettings {
    const { conversationDays: days, ...rest } = patch
    if (days !== undefined) setConversationDays(days)
    const { conversationDays: _file, ...saved } = withMediaCap({ ...this.settings(), ...rest })
    saveAppSettings({ storage: saved })
    return this.settings()
  }

  // Uma por vez: o pedido da aba no meio da automática espera a mesma.
  clean(): Promise<CleanResult> {
    this.running ??= this.run().finally(() => (this.running = null))
    return this.running
  }

  async usage(): Promise<StorageUsage> {
    const conversations = await conversationsUsage()
    if (!this.scratch || Date.now() - this.scratch.at > SCRATCH_CACHE_MS) this.measureScratch()
    return {
      conversations: conversations.count,
      conversationsBytes: conversations.bytes,
      scratchBytes: this.scratch?.bytes ?? null,
      scratchSessions: this.scratch?.sessions ?? 0,
      lastClean: loadAppSettings().storageLastClean ?? null,
      running: !!this.running
    }
  }

  private measureScratch(): void {
    this.measuring ??= scratchUsage()
      .then((u) => void (this.scratch = { ...u, at: Date.now() }))
      .catch(() => {})
      .finally(() => (this.measuring = null))
  }

  private async runIfDue(): Promise<void> {
    const last = loadAppSettings().storageLastClean
    if (last && Date.now() - last.at < EVERY_MS) return
    await this.clean().catch((err: unknown) => console.warn('[armazenamento] a limpeza falhou:', err))
  }

  private async run(): Promise<CleanResult> {
    const s = this.settings()
    const live = await this.live()
    const scratch = await cleanScratch(s.scratchDays, live)
    const media = await trimConversations(s.mediaDays, live)
    const result: CleanResult = {
      at: Date.now(),
      freedBytes: scratch.freedBytes + media.freedBytes,
      scratchRemoved: scratch.removed,
      conversationsTrimmed: media.trimmed
    }
    saveAppSettings({ storageLastClean: result })
    this.scratch = null
    return result
  }
}
