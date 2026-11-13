import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'

// Modelo Whisper "small" em ONNX, versão 4 bits: ~300 MB no total. Testado em português com áudio de
// 19 s: transcrição certa em ~3 s num Mac M (o "large-v3-turbo" acertou igual, com 739 MB e o dobro
// do tempo). Fixado num commit do repositório: uma atualização lá não troca o modelo por baixo.
export const MODEL_ID = 'onnx-community/whisper-small'
const REVISION = '36050c46d777d46dc4b5f43f6d90574fc38f8732'

// O que o transformers.js lê para esse modelo com dtype q4, e o tamanho de cada um (confere o download).
const MODEL_FILES: { path: string; size: number }[] = [
  { path: 'config.json', size: 2227 },
  { path: 'generation_config.json', size: 3893 },
  { path: 'preprocessor_config.json', size: 339 },
  { path: 'tokenizer.json', size: 2480466 },
  { path: 'tokenizer_config.json', size: 282683 },
  { path: 'onnx/encoder_model_q4.onnx', size: 66182104 },
  { path: 'onnx/decoder_model_merged_q4.onnx', size: 233149327 }
]

export const MODEL_BYTES = MODEL_FILES.reduce((n, f) => n + f.size, 0)

// Pasta com os modelos (o transformers.js procura `<pasta>/<MODEL_ID>/...`).
export const modelsDir = (): string => join(app.getPath('userData'), 'models')
const modelDir = (): string => join(modelsDir(), MODEL_ID)

// Todos os arquivos no lugar e com o tamanho certo.
export async function modelReady(): Promise<boolean> {
  for (const f of MODEL_FILES) {
    const size = await stat(join(modelDir(), f.path)).then((s) => s.size, () => -1)
    if (size !== f.size) return false
  }
  return true
}

// Baixa o que falta. Cada arquivo vai para um .part e só ganha o nome final completo: uma queda no
// meio não deixa arquivo pela metade com cara de pronto. Os que já estão certos não baixam de novo.
export async function downloadModel(signal: AbortSignal, onProgress: (received: number, total: number) => void): Promise<void> {
  let done = 0
  for (const f of MODEL_FILES) {
    const target = join(modelDir(), f.path)
    const size = await stat(target).then((s) => s.size, () => -1)
    if (size === f.size) {
      done += f.size
      onProgress(done, MODEL_BYTES)
      continue
    }
    await mkdir(dirname(target), { recursive: true })
    const part = `${target}.part`
    const url = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${f.path}`
    const res = await fetch(url, { signal })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ao baixar ${f.path}`)
    let got = 0
    const count = new Transform({
      transform(chunk: Buffer, _enc, next) {
        got += chunk.length
        onProgress(done + got, MODEL_BYTES)
        next(null, chunk)
      }
    })
    try {
      await pipeline(Readable.fromWeb(res.body as never), count, createWriteStream(part), { signal })
    } catch (err) {
      await rm(part, { force: true })
      throw err
    }
    if (got !== f.size) {
      await rm(part, { force: true })
      throw new Error(`${f.path} veio incompleto`)
    }
    await rename(part, target)
    done += f.size
  }
}
