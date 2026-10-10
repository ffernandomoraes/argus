import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { net } from 'electron'

// Sem chegar nada por este tempo, o download é dado como travado (Wi-Fi que caiu no meio).
const IDLE_MS = 60_000

// Baixa url para file. onProgress recebe de 0 a 1, de 2 em 2%: não inunda a janela com mensagens.
export async function downloadTo(url: string, file: string, version: string, onProgress: (progress: number) => void): Promise<void> {
  const controller = new AbortController()
  let idle: NodeJS.Timeout | undefined
  const arm = () => {
    clearTimeout(idle)
    idle = setTimeout(() => controller.abort(), IDLE_MS)
  }
  arm()
  try {
    const res = await net.fetch(url, { signal: controller.signal })
    if (!res.ok || !res.body) throw new Error(`O download da versão ${version} falhou (${res.status}).`)
    const total = Number(res.headers.get('content-length')) || 0
    async function* track(source: AsyncIterable<Buffer>) {
      let received = 0
      let shown = 0
      for await (const chunk of source) {
        arm()
        received += chunk.length
        const progress = total ? received / total : 0
        if (progress - shown >= 0.02) {
          shown = progress
          onProgress(progress)
        }
        yield chunk
      }
    }
    await pipeline(Readable.fromWeb(res.body as ReadableStream<Uint8Array>), track, createWriteStream(file), {
      signal: controller.signal
    })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`O download da versão ${version} parou: nada chegou em ${IDLE_MS / 1000} s.`)
    }
    throw err
  } finally {
    clearTimeout(idle)
  }
}
