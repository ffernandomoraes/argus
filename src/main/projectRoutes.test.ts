import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectRoutes } from './projectRoutes'

// Lista de endereços do campo do modo design, lida do código do projeto sem rodar nada.

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(process.env.HOME ?? '', 'routes-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

const routesOf = async (files: Record<string, string>) => (await projectRoutes(project(files))).map((r) => r.route)

describe('projectRoutes', () => {
  it('Next: app/**/page, sem grupos nem pastas privadas', async () => {
    const routes = await routesOf({
      'package.json': JSON.stringify({ dependencies: { next: '15' } }),
      'app/page.tsx': '',
      'app/(loja)/produtos/[id]/page.tsx': '',
      'app/_interno/page.tsx': '',
      'pages/sobre.tsx': '',
      'pages/api/user.ts': ''
    })
    expect(routes).toEqual(['/', '/produtos/[id]', '/sobre'])
  })

  it('num app React comum, src/pages é só pasta de componentes: valem as rotas escritas', async () => {
    const routes = await routesOf({
      'package.json': JSON.stringify({ dependencies: { react: '19' } }),
      'src/pages/Login.tsx': 'navigate("/home")',
      'src/App.tsx': '<Route path="/login" /> <a href="/ajuda/">x</a> fetch("/api/x") <img src="/logo.png" />'
    })
    expect(routes).toEqual(['/ajuda', '/home', '/login'])
  })

  it('arquivo de rotas: todo texto com barra conta; node_modules e pastas ocultas ficam de fora', async () => {
    const routes = await routesOf({
      'src/routes.ts': "export const R = { LOGIN: '/entrar', HOME: '/' }",
      'node_modules/lib/routes.ts': "'/nao'",
      '.cache/routes.ts': "'/nao-tambem'"
    })
    expect(routes).toEqual(['/', '/entrar'])
  })

  it('pasta que não existe: lista vazia', async () => {
    expect(await projectRoutes(join(process.env.HOME ?? '', 'nada'))).toEqual([])
  })
})
