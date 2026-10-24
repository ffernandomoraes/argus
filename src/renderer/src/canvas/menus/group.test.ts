import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState, ClaudeAccount } from '../../../../shared/auth'
import type { ProviderAccount, ProvidersState } from '../../../../shared/providers'
import type { MenuItem } from '../ContextMenu'
import type { AreaNode, CanvasNode } from '../types'

// Menu do grupo: escolher o agente e a conta das conversas novas, e excluir o grupo sem deixar
// processos rodando escondidos.

const providers = vi.hoisted(() => ({ state: null as ProvidersState | null }))
vi.mock('../../providers/useProviders', () => ({ getProviders: () => providers.state }))
// O store das contas pede ao processo principal ao ser carregado; aqui só as funções puras.
vi.mock('../../auth/useAuth', async () => ({ ...(await import('../../auth/accounts')), getAuth: () => null }))

const kill = vi.fn()
;(globalThis as unknown as { window: { api: Record<string, unknown> } }).window.api.terminal = { kill }

const { groupMenu } = await import('./group')

const account = (id: string, loggedIn: boolean | null): ClaudeAccount =>
  ({ id, name: id, customName: false, status: loggedIn === null ? null : { loggedIn } }) as ClaudeAccount
const auth = (accounts: ClaudeAccount[]): AuthState => ({ accounts, defaultId: accounts[0].id }) as AuthState
const group = (account?: string) => ({ id: 'g', type: 'area', position: { x: 0, y: 0 }, data: { label: 'Trabalho', color: '#71717a', account } }) as AreaNode

function menu(nodes: CanvasNode[], options: { auth?: AuthState | null; group?: AreaNode } = {}) {
  const deps = {
    nodes,
    setNodes: vi.fn(),
    auth: options.auth ?? null,
    confirm: vi.fn(),
    startRename: vi.fn(),
    addFolder: vi.fn(),
    openGroupWide: vi.fn(),
    addTerminal: vi.fn(),
    addNote: vi.fn(),
    toggleGroup: vi.fn(),
    organizeGroup: vi.fn(),
    moveToBoard: vi.fn()
  }
  return { items: groupMenu(deps, options.group ?? group()), deps }
}

const find = (items: MenuItem[], label: string) => items.find((i) => 'label' in i && i.label === label)
const sub = (items: MenuItem[], label: string) => {
  const item = find(items, label)
  return item?.type === 'submenu' ? item.items : undefined
}
const labels = (items: MenuItem[] | undefined) => items?.map((i) => ('label' in i ? i.label : i.type))

beforeEach(() => {
  providers.state = null
  kill.mockClear()
})

// 7642ce1: conta do Claude sem login aparecia para escolher no menu de conta do grupo.
describe('Agente ▸ Claude', () => {
  it('conta sem login não aparece; a que não respondeu ainda (null) aparece', () => {
    const { items } = menu([], { auth: auth([account('principal', true), account('trabalho', false), account('nova', null)]) })
    expect(labels(sub(sub(items, 'Agente')!, 'Claude'))).toEqual(['principal', 'nova'])
  })

  it('a conta do grupo aparece mesmo sem login, marcada e avisando', () => {
    const { items } = menu([], { auth: auth([account('principal', true), account('trabalho', false)]), group: group('trabalho') })
    const claude = sub(sub(items, 'Agente')!, 'Claude')!
    expect(labels(claude)).toEqual(['principal', 'trabalho - sem login'])
    expect(claude[1]).toMatchObject({ checked: true })
    expect(claude[0]).toMatchObject({ checked: false })
  })

  it('conta escolhida que foi removida: o visto vai para a padrão', () => {
    const { items } = menu([], { auth: auth([account('principal', true), account('outra', true)]), group: group('removida') })
    expect(sub(sub(items, 'Agente')!, 'Claude')![0]).toMatchObject({ label: 'principal', checked: true })
  })
})

describe('Agente ▸ outros agentes', () => {
  const codex = (id: string, signedIn: boolean): ProviderAccount => ({ id, provider: 'codex', kind: 'chatgpt', name: id, customName: false, status: { signedIn } }) as unknown as ProviderAccount

  function withCodex(accounts: ProviderAccount[]) {
    const none = { install: {}, accounts: [], defaultId: null }
    providers.state = {
      providers: { codex: { install: {}, accounts, defaultId: accounts[0]?.id ?? null }, gemini: none, cursor: none },
      login: {}
    } as unknown as ProvidersState
  }

  it('só entra o agente com conta conectada', () => {
    withCodex([codex('main', true), codex('velha', false)])
    const { items } = menu([], { auth: auth([account('principal', true)]) })
    const agents = sub(items, 'Agente')!
    expect(labels(agents)).toEqual(['Claude', 'Codex'])
    expect(labels(sub(agents, 'Codex'))).toEqual(['main'])
  })

  it('agente só com contas sem login fica de fora', () => {
    withCodex([codex('velha', false)])
    const { items } = menu([], { auth: auth([account('principal', true)]) })
    expect(labels(sub(items, 'Agente'))).toEqual(['Claude'])
  })
})

describe('Excluir grupo', () => {
  const terminal = (id: string) => ({ id, type: 'terminal', parentId: 'g', position: { x: 0, y: 0 }, data: { name: id, path: '~' } }) as CanvasNode
  const folder = { id: 'p', type: 'project', parentId: 'g', position: { x: 0, y: 0 }, data: { name: 'p', path: '~/p', color: '#fff' } } as CanvasNode

  // O processo do terminal não morre com o bloco: sem isso, `claude` e `pnpm dev` ficariam
  // rodando escondidos até fechar o app.
  it('pede confirmação e, confirmado, encerra os terminais de dentro e tira o grupo', () => {
    const nodes = [group(), folder, terminal('t1'), terminal('t2')]
    const { items, deps } = menu(nodes)
    const remove = find(items, 'Excluir grupo')
    if (remove?.type !== 'action') throw new Error('sem "Excluir grupo"')
    remove.onSelect()
    expect(kill).not.toHaveBeenCalled()
    const asked = deps.confirm.mock.calls[0][0]
    expect(asked.description).toContain('3 instâncias')
    expect(asked.description).toContain('os 2 terminais serão encerrados')
    asked.onConfirm()
    expect(kill.mock.calls.map((c) => c[0])).toEqual(['t1', 't2'])
    const update = deps.setNodes.mock.calls[0][0] as (ns: CanvasNode[]) => CanvasNode[]
    expect(update(nodes)).toEqual([])
  })

  it('grupo vazio: desagrupar, ajustar e organizar ficam desligados', () => {
    const { items } = menu([group()])
    for (const label of ['Desagrupar tudo', 'Ajustar ao conteúdo', 'Organizar grupo']) expect(find(items, label)).toMatchObject({ disabled: true })
  })
})
