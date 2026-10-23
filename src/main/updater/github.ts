import { net } from 'electron'
import { tr } from '../i18n'
import { transientNetError } from './network'
import { apiFailure, type Release } from './releases'

// Consultas à API do GitHub (repositório público, sem login).
const API = 'https://api.github.com/repos/ffernandomoraes/argus'
const TIMEOUT_MS = 30_000

// Resposta guardada de cada endereço, com o ETag: a próxima consulta leva o If-None-Match e, se
// nada mudou, o GitHub responde 304, que não conta no limite de consultas.
const cache = new Map<string, { etag: string; body: unknown }>()

// Espera antes de cada nova tentativa quando a rede falha de passagem (ver network.ts).
const RETRY_MS = [2_000, 5_000]

// A rede mudou ou caiu: tenta de novo algumas vezes antes de desistir.
async function fetchRetrying(url: string, init: () => RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await net.fetch(url, init())
    } catch (err) {
      const code = transientNetError(err)
      if (!code) throw err
      if (attempt >= RETRY_MS.length) {
        throw new Error(
          tr(
            `Sem conexão com o GitHub ao procurar a versão nova (${code}). Procure de novo daqui a pouco.`,
            `No connection to GitHub while checking for a new version (${code}). Check again shortly.`
          )
        )
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS[attempt]))
    }
  }
}

// null quando o endereço não existe (nenhum release publicado ainda).
async function getJson<T>(path: string): Promise<T | null> {
  const url = `${API}${path}`
  const cached = cache.get(url)
  let res: Response
  try {
    res = await fetchRetrying(url, () => ({
      headers: { Accept: 'application/vnd.github+json', ...(cached && { 'If-None-Match': cached.etag }) },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    }))
  } catch (err) {
    if ((err as Error).name === 'TimeoutError') throw new Error(tr('O GitHub não respondeu a tempo ao procurar a versão nova.', "GitHub didn't respond in time while checking for a new version."))
    throw err
  }
  if (res.status === 304 && cached) return cached.body as T
  if (res.status === 404) return null
  if (!res.ok) throw new Error(apiFailure(res.status, (name) => res.headers.get(name)))
  const body = (await res.json()) as T
  const etag = res.headers.get('etag')
  if (etag) cache.set(url, { etag, body })
  return body
}

export const fetchLatestRelease = () => getJson<Release>('/releases/latest')

// Os mais recentes (do mais novo para o mais velho), para achar um que tenha o instalador.
export async function fetchRecentReleases(): Promise<Release[]> {
  const list = await getJson<Release[]>('/releases?per_page=10')
  return Array.isArray(list) ? list : []
}
