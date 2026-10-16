import { join } from 'node:path'
import { utilityProcess, type UtilityProcess } from 'electron'
import type { TranscriptionModel } from '../../shared/transcription'
import { lang, tr } from '../i18n'
import { downloadModel, MODEL_BYTES, MODEL_ID, modelReady, modelsDir } from './model'
import type { WorkerRequest, WorkerResponse } from './worker'

// Sem áudio para transcrever por este tempo, o processo do Whisper fecha e devolve a memória do
// modelo (~300 MB); o próximo áudio abre de novo (alguns segundos a mais).
const IDLE_MS = 3 * 60_000
// Progresso do download para as janelas: no máximo a cada este tempo.
const PROGRESS_MS = 200

type Pending = { resolve: (text: string) => void; reject: (err: Error) => void }

// Transcrição de áudio anexado (Configurações > Experimentos): o modelo, baixado só quando a pessoa
// aceita, e o processo que roda o Whisper (worker.ts).
export class Transcription {
  private state: TranscriptionModel = { status: 'missing', total: MODEL_BYTES }
  private download: AbortController | null = null
  private worker: UtilityProcess | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private idle: NodeJS.Timeout | null = null

  constructor(private onState: (state: TranscriptionModel) => void) {}

  // Situação atual. Fora de um download, confere o disco (a pasta pode ter sido apagada).
  async model(): Promise<TranscriptionModel> {
    if (this.state.status !== 'downloading') this.state = (await modelReady()) ? { status: 'ready' } : { status: 'missing', total: MODEL_BYTES }
    return this.state
  }

  // Começa o download (pedido de novo no meio, segue o mesmo). As janelas acompanham por onState.
  startDownload(): void {
    if (this.download) return
    const abort = new AbortController()
    this.download = abort
    let shown = 0
    this.set({ status: 'downloading', received: 0, total: MODEL_BYTES })
    downloadModel(abort.signal, (received, total) => {
      const now = Date.now()
      if (now - shown < PROGRESS_MS && received < total) return
      shown = now
      this.set({ status: 'downloading', received, total })
    })
      .then(() => this.set({ status: 'ready' }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return this.set({ status: 'missing', total: MODEL_BYTES })
        const detail = err instanceof Error ? err.message : String(err)
        this.set({ status: 'error', message: tr(`Não deu para baixar o modelo (${detail}).`, `Couldn’t download the model (${detail}).`) })
      })
      .finally(() => {
        if (this.download === abort) this.download = null
      })
  }

  cancelDownload(): void {
    this.download?.abort()
  }

  // Texto do áudio (mono, 16 kHz). Falha se o modelo não estiver baixado.
  async transcribe(samples: Float32Array): Promise<string> {
    if (!(await modelReady())) throw new Error(tr('O modelo de transcrição não está baixado.', 'The transcription model isn’t downloaded.'))
    const worker = this.ensureWorker()
    const id = this.nextId++
    this.holdOpen()
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const request: WorkerRequest = { id, modelsDir: modelsDir(), modelId: MODEL_ID, samples, language: lang() === 'pt' ? 'portuguese' : undefined }
      worker.postMessage(request)
    }).finally(() => this.holdOpen())
  }

  private set(state: TranscriptionModel): void {
    this.state = state
    this.onState(state)
  }

  private ensureWorker(): UtilityProcess {
    if (this.worker) return this.worker
    const worker = utilityProcess.fork(join(__dirname, 'transcriber.js'), [], { serviceName: 'Argus Transcription' })
    worker.on('message', (m: WorkerResponse) => {
      const p = this.pending.get(m.id)
      if (!p) return
      this.pending.delete(m.id)
      if ('error' in m) p.reject(new Error(m.error))
      else p.resolve(m.text)
    })
    // Caiu (ou fechou por ociosidade): o que estava esperando falha, e o próximo áudio abre outro.
    worker.on('exit', () => {
      if (this.worker === worker) this.worker = null
      for (const p of this.pending.values()) p.reject(new Error(tr('A transcrição parou no meio.', 'Transcription stopped midway.')))
      this.pending.clear()
    })
    this.worker = worker
    return worker
  }

  // Reinicia a contagem para fechar o processo; com transcrição em andamento, não fecha.
  private holdOpen(): void {
    if (this.idle) clearTimeout(this.idle)
    this.idle = setTimeout(() => {
      if (this.pending.size === 0) this.worker?.kill()
    }, IDLE_MS)
  }
}
