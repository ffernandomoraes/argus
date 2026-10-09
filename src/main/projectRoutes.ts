import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { realRoot } from './devServers'

// Rotas de um projeto, para a lista do campo de endereço do modo design. Lidas do código, sem
// rodar nada: as pastas de páginas dos frameworks que usam arquivos como rotas (Next, Nuxt,
// SvelteKit, Astro, Remix) e os caminhos escritos nas rotas do código (React Router, Vue Router,
// links e navegações). É uma estimativa: cada projeto liga arquivo e endereço do seu jeito.
export type ProjectRoute = { route: string; from: string }

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.output', 'coverage', '.turbo', '.cache', 'vendor'])
const CODE = /\.(tsx|jsx|ts|js|mjs|vue|svelte|astro|mdx?)$/
const MAX_FILES = 4000
const MAX_SIZE = 300_000
const MAX_ROUTES = 300

// Caminho escrito como rota: path="/x", path: '/x', to="/x", href="/x", navigate('/x'), push('/x'),
// app.get('/x') de um servidor Node.
const WRITTEN =
  /(?:\b(?:path|to|href|redirect|route)\s*[:=]\s*\{?\s*|\b(?:navigate|push|replace|redirect)\(\s*|\.(?:get|all)\(\s*)["'`](\/[A-Za-z0-9_\-/:[\].]*)["'`]/g
// Mapa de rotas de um servidor simples: { '/busca': 'busca.html' }.
const ROUTE_MAP = /["'](\/[A-Za-z0-9_\-/]*)["']\s*:\s*["'][^"']+\.html["']/g
// Arquivo só de rotas (routes.ts, paths.ts, router.tsx...): constantes como { LOGIN: '/login' }.
// Nele, todo texto que começa com barra conta como rota.
const ROUTES_FILE = /(^|[/._-])(routes?|router|paths?|urls?|navigation)[^/]*\.(ts|tsx|js|jsx|mjs)$/i
const ANY_PATH = /["'`](\/[A-Za-z0-9_\-/:[\].]*)["'`]/g
// Endereço que não é página: API, arquivos estáticos.
const NOT_PAGE = /^\/(api|_next|static|assets|public)(\/|$)|\.(png|jpe?g|gif|svg|ico|webp|css|js|json|map|txt|xml|woff2?)$/i

async function files(root: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 8 || out.length >= MAX_FILES) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return
      if (e.isDirectory()) {
        if (!SKIP.has(e.name) && !e.name.startsWith('.')) await walk(join(dir, e.name), depth + 1)
      } else if (e.isFile() && CODE.test(e.name)) out.push(join(dir, e.name))
    }
  }
  await walk(root, 0)
  return out
}

// Rota de um arquivo numa pasta de páginas: "app/produtos/[id]/page.tsx" vira "/produtos/[id]".
// Grupos "(loja)" e segmentos privados "_x" não entram no endereço.
// Só os frameworks que o projeto usa: num app React comum, src/pages/ é só uma pasta de componentes.
type Frameworks = { next: boolean; nuxt: boolean; astro: boolean; sveltekit: boolean; remix: boolean }

async function frameworksOf(root: string): Promise<Frameworks> {
  let deps: Record<string, string> = {}
  try {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    deps = { ...pkg.dependencies, ...pkg.devDependencies }
  } catch {
    // sem package.json: só os caminhos escritos no código
  }
  const has = (name: string) => name in deps || Object.keys(deps).some((d) => d.startsWith(name + '/'))
  return { next: has('next'), nuxt: has('nuxt'), astro: has('astro'), sveltekit: has('@sveltejs/kit'), remix: has('@remix-run') || has('@react-router/dev') }
}

function fileRoute(rel: string, fw: Frameworks): string | null {
  const parts = rel.split('/')
  const at = (dir: string) => parts.indexOf(dir)
  const clean = (segs: string[]) => {
    const kept = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'))
    if (kept.some((s) => s.startsWith('_'))) return null
    return '/' + kept.join('/')
  }
  const file = parts[parts.length - 1]
  const stem = file.replace(/\.[^.]+$/, '')
  // Next (app): app/**/page.*
  const app = at('app')
  if (fw.next && app >= 0 && stem === 'page') return clean(parts.slice(app + 1, -1))
  // SvelteKit: src/routes/**/+page.svelte
  const routes = at('routes')
  if (fw.sveltekit && routes >= 0 && file.startsWith('+page.')) return clean(parts.slice(routes + 1, -1))
  // Remix: app/routes/a.b.tsx (ponto vira barra; _index é a raiz da pasta)
  if (fw.remix && routes >= 0 && parts[routes - 1] === 'app' && routes === parts.length - 2) {
    const segs = stem.split('.').filter((s) => s !== '_index' && s !== 'route')
    return clean(segs.map((s) => s.replace(/^\$/, ':')))
  }
  // Next (pages), Nuxt, Astro: pages/**/*.* (index é a raiz da pasta)
  const pages = at('pages')
  if ((fw.next || fw.nuxt || fw.astro) && pages >= 0) {
    const segs = [...parts.slice(pages + 1, -1), stem].filter((s) => s !== 'index')
    if (segs[0] === 'api' || stem.startsWith('_')) return null
    return clean(segs)
  }
  return null
}

export async function projectRoutes(projectPath: string): Promise<ProjectRoute[]> {
  const root = realRoot(projectPath)
  try {
    if (!(await stat(root)).isDirectory()) return []
  } catch {
    return []
  }
  const fw = await frameworksOf(root)
  const found = new Map<string, string>()
  const add = (route: string | null, from: string) => {
    if (!route || found.size >= MAX_ROUTES) return
    const r = route.length > 1 ? route.replace(/\/+$/, '') : route
    if (!r.startsWith('//') && !NOT_PAGE.test(r) && !found.has(r)) found.set(r, from)
  }
  for (const file of await files(root)) {
    const rel = relative(root, file).split(sep).join('/')
    add(fileRoute(rel, fw), rel)
    try {
      if ((await stat(file)).size > MAX_SIZE) continue
      const text = await readFile(file, 'utf8')
      for (const m of text.matchAll(WRITTEN)) add(m[1], rel)
      for (const m of text.matchAll(ROUTE_MAP)) add(m[1], rel)
      if (ROUTES_FILE.test(rel)) for (const m of text.matchAll(ANY_PATH)) add(m[1], rel)
    } catch {
      // arquivo sumiu ou não dá para ler
    }
  }
  return [...found].map(([route, from]) => ({ route, from })).sort((a, b) => a.route.localeCompare(b.route))
}
