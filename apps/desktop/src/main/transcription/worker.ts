import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

// Processo à parte (utilityProcess) que roda o Whisper: o motor é nativo (onnxruntime-node) e
// carrega ~300 MB de modelo; uma falha ou o uso de memória dele não atingem o processo principal.
// Recebe o áudio já decodificado pela janela (mono, 16 kHz) e devolve o texto.

// language: idioma forçado (o do app em português); sem ele, o modelo detecta.
export type WorkerRequest = { id: number; modelsDir: string; modelId: string; samples: Float32Array; language?: string }
export type WorkerResponse = { id: number; text: string } | { id: number; error: string }

type Port = { on: (event: 'message', cb: (e: { data: WorkerRequest }) => void) => void; postMessage: (m: WorkerResponse) => void }
const port = (process as unknown as { parentPort: Port }).parentPort

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null

// Só o que está no disco: nada de buscar modelo na internet por conta própria (o download é do main).
function load(modelsDir: string, modelId: string): Promise<AutomaticSpeechRecognitionPipeline> {
  env.localModelPath = modelsDir
  env.allowRemoteModels = false
  asr ??= pipeline('automatic-speech-recognition', modelId, {
    dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' }
  }) as Promise<AutomaticSpeechRecognitionPipeline>
  asr.catch(() => (asr = null))
  return asr
}

// Um de cada vez: dois áudios anexados juntos esperam a vez em vez de disputar o processador.
let queue = Promise.resolve()

port.on('message', ({ data }) => {
  queue = queue.then(async () => {
    try {
      const run = await load(data.modelsDir, data.modelId)
      // Trechos de 30 s, com sobra entre eles, cobrem áudio de qualquer duração.
      const out = await run(data.samples, { language: data.language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
      const text = (Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text).trim()
      port.postMessage({ id: data.id, text })
    } catch (err) {
      port.postMessage({ id: data.id, error: err instanceof Error ? err.message : String(err) })
    }
  })
})
