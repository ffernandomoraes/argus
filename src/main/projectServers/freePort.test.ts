import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { freePort } from './freePort'
import { packageManager, projectScript, type ProjectScript } from './scripts'

// Portas abertas no computador: no teste, as que cada caso disser.
const busy = vi.hoisted(() => ({ ports: [] as number[] }))
vi.mock('../processScan', () => ({ scanListening: async () => [{ pid: 1, ports: busy.ports }] }))

const folder = () => mkdtempSync(join(process.env.HOME ?? '', 'server-'))
const vite = (body = 'vite', manager = 'pnpm'): ProjectScript => ({ script: 'dev', command: `${manager} run dev`, body, manager })

beforeEach(() => {
  busy.ports = []
})

// 6e46860: o servidor aberto pelo Argus caía na mesma porta de outro já rodando (o Vite não pula
// de porta quando os dois abrem em endereços diferentes), e os dois respondiam no mesmo endereço.
describe('freePort', () => {
  it('porta do Vite livre: o comando fica como está', async () => {
    busy.ports = [3000]
    expect(await freePort(folder(), vite())).toEqual(vite())
  })

  it('porta ocupada: passa a primeira livre depois dela', async () => {
    busy.ports = [5173, 5174, 8080]
    expect((await freePort(folder(), vite())).command).toBe('pnpm run dev --port 5175')
  })

  it('no npm, a porta vai depois de "--"', async () => {
    busy.ports = [5173]
    expect((await freePort(folder(), vite('vite dev', 'npm'))).command).toBe('npm run dev -- --port 5174')
  })

  it('usa a porta do vite.config', async () => {
    const root = folder()
    writeFileSync(join(root, 'vite.config.ts'), 'export default { server: { port: 3001 } }')
    busy.ports = [3001]
    expect((await freePort(root, vite())).command).toBe('pnpm run dev --port 3002')
  })

  it('porta fixada pela pessoa: respeita a escolha dela', async () => {
    busy.ports = [5173, 4000]
    expect(await freePort(folder(), vite('vite --port 4000'))).toEqual(vite('vite --port 4000'))
    const root = folder()
    writeFileSync(join(root, 'vite.config.mjs'), 'export default { server: { strictPort: true } }')
    expect(await freePort(root, vite())).toEqual(vite())
  })

  it('script que não é o vite direto fica como está', async () => {
    busy.ports = [5173]
    for (const body of ['turbo dev', 'vite build && vite preview', 'vitest', 'next dev']) {
      expect(await freePort(folder(), vite(body))).toEqual(vite(body))
    }
  })
})

describe('packageManager e projectScript', () => {
  it('o gerenciador declarado no package.json vale primeiro', () => {
    expect(packageManager(folder(), 'yarn@4.1.0')).toBe('yarn')
  })

  it('em monorepo, acha a trava numa pasta acima', () => {
    const root = folder()
    writeFileSync(join(root, 'pnpm-lock.yaml'), '')
    mkdirSync(join(root, 'apps', 'web'), { recursive: true })
    expect(packageManager(join(root, 'apps', 'web'), undefined)).toBe('pnpm')
  })

  it('sem nada, npm', () => {
    expect(packageManager(folder(), 'gerenciador-estranho')).toBe('npm')
  })

  it('roda o dev; sem ele, o start; sem nenhum, nada', async () => {
    const pkg = (scripts: Record<string, string>) => {
      const root = folder()
      writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts, packageManager: 'pnpm@11.0.0' }))
      return root
    }
    expect(await projectScript(pkg({ start: 'node a', dev: 'vite' }))).toEqual({ script: 'dev', command: 'pnpm run dev', body: 'vite', manager: 'pnpm' })
    expect((await projectScript(pkg({ start: 'node a' })))?.script).toBe('start')
    expect(await projectScript(pkg({ build: 'tsc' }))).toBeNull()
    expect(await projectScript(folder())).toBeNull()
  })
})
