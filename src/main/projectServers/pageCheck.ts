// Porta que mostra página: o "/" responde com HTML. Uma API responde JSON ou erro, e a porta do
// recarregamento ao vivo (HMR) pede WebSocket. A conferência roda à parte, sem segurar o status:
// enquanto a primeira não volta, a resposta é "não sei" (undefined) e a tela mostra um loader.
// Guardada por processo e porta: a página de uma porta não muda enquanto o processo vive. O "não"
// vale menos, porque o app pode só não ter terminado de subir; mas cada conferência é um pedido no
// servidor da pessoa (aparece no terminal dela), então a espera entre elas dobra até 1 minuto. A
// espera do pedido é longa porque a primeira página de um app pode levar segundos para compilar.
const PAGE_TTL = 10 * 60_000
const NOT_PAGE_TTL = 5_000
const NOT_PAGE_MAX = 60_000
const PAGE_WAIT = 10_000
const MAX_REDIRECTS = 3

type Known = { page?: boolean; at: number; misses: number; checking?: boolean }
const pages = new Map<string, Known>()

export const pageKey = (pid: number, port: number): string => `${pid}:${port}`

const ttlOf = (k: Known) => (k.page ? PAGE_TTL : Math.min(NOT_PAGE_TTL * 2 ** Math.max(0, k.misses - 1), NOT_PAGE_MAX))

// Redirecionamento seguido só no mesmo servidor: o "/" que manda para "/login" é página. Para outro
// endereço (o login de um serviço de fora) também é, sem buscar nada lá.
async function checkPage(port: number): Promise<boolean> {
  const signal = AbortSignal.timeout(PAGE_WAIT)
  let url = `http://localhost:${port}/`
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal, headers: { accept: 'text/html' } })
    void res.body?.cancel().catch(() => {})
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!location) return res.ok && (res.headers.get('content-type') ?? '').includes('text/html')
    const next = new URL(location, url)
    if (next.origin !== new URL(url).origin) return true
    url = next.href
  }
  return false
}

export function servesPage(pid: number, port: number): boolean | undefined {
  const key = pageKey(pid, port)
  const known = pages.get(key)
  if (known && (known.checking || Date.now() - known.at < ttlOf(known))) return known.page
  const entry: Known = { page: known?.page, at: known?.at ?? 0, misses: known?.misses ?? 0, checking: true }
  pages.set(key, entry)
  void checkPage(port)
    // Não respondeu HTTP (ou não a tempo).
    .catch(() => false)
    .then((page) => {
      // A porta fechou enquanto conferia: nada a guardar.
      if (pages.get(key) !== entry) return
      pages.set(key, { page, at: Date.now(), misses: page ? 0 : entry.misses + 1 })
    })
  return entry.page
}

// Esquece as portas que fecharam: o mesmo número em outro processo é outra página.
export function keepPages(alive: Iterable<string>): void {
  const keep = new Set(alive)
  for (const key of pages.keys()) if (!keep.has(key)) pages.delete(key)
}
