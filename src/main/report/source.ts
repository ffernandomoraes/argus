import { gunzipSync } from 'node:zlib'
import { net } from 'electron'
import { errorMessage } from '../lib/errors'

// O código do Argus na versão instalada, para a investigação ler (ver tools.ts): o app instalado
// só tem o código empacotado e minificado. Vem do GitHub (repositório público, a mesma origem do
// atualizador), pela tag que o release cria (v<versão>), num .tar.gz só (~1 MB), e fica em memória:
// nada é gravado na máquina. Sem a tag (versão de desenvolvimento à frente do último release), o
// da main, avisando.

const REPO = 'ffernandomoraes/argus'
const TIMEOUT_MS = 60_000
// Só texto que ajuda a entender o app; o lockfile e as imagens ficam de fora.
const KEEP = /\.(ts|tsx|mts|mjs|cjs|js|json|md|ya?ml|css|sh|html|swift|ps1)$/i
const SKIP = /(^|\/)(pnpm-lock\.yaml|package-lock\.json)$/
const FILE_MAX = 400_000

export type Source = { ref: string; note?: string; files: Map<string, string> }

const cstr = (b: Buffer, start: number, len: number) => {
  const s = b.subarray(start, start + len)
  const end = s.indexOf(0)
  return s.subarray(0, end < 0 ? len : end).toString('utf8')
}

// Leitor de tar mínimo: arquivos comuns e o caminho longo do cabeçalho pax, o que o GitHub gera.
// O primeiro nível (argus-<versão>/) sai do caminho.
function untar(buf: Buffer): Map<string, string> {
  const files = new Map<string, string>()
  let off = 0
  let longPath: string | null = null
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512)
    if (header.every((b) => b === 0)) break
    const size = parseInt(cstr(header, 124, 12).trim() || '0', 8)
    const type = String.fromCharCode(header[156] || 48)
    const data = buf.subarray(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
    if (type === 'x') {
      const m = /\d+ path=([^\n]*)\n/.exec(data.toString('utf8'))
      longPath = m ? m[1] : null
      continue
    }
    if (type === 'g') continue
    const prefix = cstr(header, 345, 155)
    const name = longPath ?? (prefix ? `${prefix}/${cstr(header, 0, 100)}` : cstr(header, 0, 100))
    longPath = null
    if (type !== '0') continue
    const path = name.split('/').slice(1).join('/')
    if (!path || !KEEP.test(path) || SKIP.test(path) || size > FILE_MAX) continue
    files.set(path, data.toString('utf8'))
  }
  return files
}

async function download(ref: string): Promise<Map<string, string> | null> {
  const res = await net.fetch(`https://codeload.github.com/${REPO}/tar.gz/${ref}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`)
  return untar(gunzipSync(Buffer.from(await res.arrayBuffer())))
}

async function load(version: string): Promise<Source> {
  const tag = `v${version}`
  const files = await download(`refs/tags/${tag}`)
  if (files) return { ref: tag, files }
  const main = await download('refs/heads/main')
  if (!main) throw new Error('o repositório não respondeu')
  return { ref: 'main', note: `A tag ${tag} não existe; este é o código da main, que pode ser diferente do instalado.`, files: main }
}

// Uma vez por versão enquanto o app está aberto; uma falha não fica guardada (a próxima
// investigação tenta de novo).
const cache = new Map<string, Promise<Source>>()

export function sourceFor(version: string): Promise<Source> {
  let p = cache.get(version)
  if (!p) {
    p = load(version).catch((err: unknown) => {
      cache.delete(version)
      throw new Error(`Não deu para baixar o código do Argus do GitHub (${errorMessage(err)}).`)
    })
    cache.set(version, p)
  }
  return p
}
