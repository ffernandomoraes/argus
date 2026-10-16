import { isAudioFile, TRANSCRIPTION_SAMPLE_RATE, type TranscriptionModel } from '../../../../shared/transcription'
import { createStore } from '../../lib/createStore'
import { getPreferences } from '../../settings/preferences'
import { tr } from '../../i18n'

// Transcrição dos áudios anexados (Configurações > Experimentos). Cada áudio anexado ganha uma
// situação; o texto pronto vai junto da mensagem (ver transcriptsText). Sem o modelo no
// computador, o anexo pergunta antes de baixar; com a resposta "agora não", vai sem transcrição.
export type Transcript =
  | { status: 'asking' }
  // Modelo baixando: transcreve quando terminar.
  | { status: 'waiting' }
  | { status: 'transcribing' }
  | { status: 'done'; text: string }
  | { status: 'error'; message: string }
  | { status: 'skipped' }

// Situação do modelo, igual em todas as janelas (o download é um só, no processo principal).
export const modelStore = createStore<TranscriptionModel | null>(null)
// Por arquivo anexado. Sai ao tirar o anexo e depois do envio.
export const transcriptStore = createStore<Map<File, Transcript>>(new Map())

let listening = false

function listenModel(): void {
  if (listening) return
  listening = true
  window.api.transcription.onModel((state) => {
    modelStore.set(state)
    if (state.status === 'ready') each('waiting', transcribe)
    // Download cancelado ou com erro: os áudios voltam a perguntar (o erro aparece no anexo).
    else if (state.status !== 'downloading') each('waiting', (file) => put(file, { status: 'asking' }))
  })
}

async function currentModel(): Promise<TranscriptionModel> {
  listenModel()
  const known = modelStore.get()
  if (known) return known
  const state = await window.api.transcription.model()
  modelStore.set((prev) => prev ?? state)
  return modelStore.get() ?? state
}

function put(file: File, t: Transcript): void {
  transcriptStore.set((prev) => new Map(prev).set(file, t))
}

function each(status: Transcript['status'], fn: (file: File) => void): void {
  for (const [file, t] of transcriptStore.get()) if (t.status === status) fn(file)
}

// Anexo novo: com a transcrição ligada e sendo áudio, começa (ou pergunta, sem o modelo). Anexo que
// já tem situação (voltou ao campo depois de um envio que falhou) fica como estava.
export async function watchAudio(file: File): Promise<void> {
  if (!getPreferences().audioTranscription || !isAudioFile(file.name, file.type)) return
  if (transcriptStore.get().has(file)) return
  put(file, { status: 'waiting' })
  const model = await currentModel()
  if (!transcriptStore.get().has(file)) return
  if (model.status === 'ready') void transcribe(file)
  else if (model.status !== 'downloading') put(file, { status: 'asking' })
}

// "Baixar": o download começa e os áudios que perguntavam esperam por ele.
export function downloadModel(): void {
  each('asking', (file) => put(file, { status: 'waiting' }))
  window.api.transcription.download()
}

export function cancelDownload(): void {
  window.api.transcription.cancel()
}

// "Agora não": o áudio vai como arquivo comum, sem texto.
export function skipTranscript(file: File): void {
  put(file, { status: 'skipped' })
}

export function retryTranscript(file: File): void {
  void transcribe(file)
}

export function forgetTranscripts(files: File[]): void {
  if (!files.some((f) => transcriptStore.get().has(f))) return
  transcriptStore.set((prev) => {
    const next = new Map(prev)
    for (const f of files) next.delete(f)
    return next
  })
}

// Algum áudio ainda sem decisão ou sem texto: o envio espera (ver Composer).
export function transcriptsPending(files: File[]): boolean {
  const map = transcriptStore.get()
  return files.some((f) => {
    const s = map.get(f)?.status
    return s === 'asking' || s === 'waiting' || s === 'transcribing'
  })
}

// O texto dos áudios transcritos, para ir no fim da mensagem (e aparecer no balão dela).
export function transcriptsText(files: File[]): string {
  const map = transcriptStore.get()
  const parts: string[] = []
  for (const f of files) {
    const t = map.get(f)
    if (t?.status !== 'done') continue
    const body = t.text || tr('(nenhuma fala reconhecida)', '(no speech recognized)')
    parts.push(`${tr(`Transcrição do áudio ${f.name}`, `Transcript of the audio ${f.name}`)}:\n"${body}"`)
  }
  return parts.join('\n\n')
}

async function transcribe(file: File): Promise<void> {
  put(file, { status: 'transcribing' })
  try {
    const text = await window.api.transcription.transcribe(await decode(file))
    if (transcriptStore.get().has(file)) put(file, { status: 'done', text })
  } catch (err) {
    if (!transcriptStore.get().has(file)) return
    const detail = err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : ''
    put(file, { status: 'error', message: detail || tr('Não deu para transcrever.', 'Couldn’t transcribe.') })
  }
}

// O áudio em amostras mono a 16 kHz, como o Whisper lê. O Chromium do Electron decodifica os
// formatos comuns (ogg/opus do WhatsApp, mp3, m4a/aac, wav) e já converte para a taxa do contexto.
async function decode(file: File): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, 1, TRANSCRIPTION_SAMPLE_RATE)
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer()).catch(() => {
    throw new Error(tr('Formato de áudio que o Argus não abre.', 'Audio format Argus can’t open.'))
  })
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  // Estéreo: a média dos canais.
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels
  }
  return mono
}
