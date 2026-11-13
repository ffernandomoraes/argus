import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Workspaces: cada um com o canvas dele, e o primeiro no canvas.json de sempre. Nenhum caminho aqui
// pode misturar o canvas de um workspace com o de outro nem perder o canvas de quem atualizou.

const dir = () => app.getPath('userData')
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const FOLDER = { id: 'p-1', type: 'project', position: { x: 0, y: 0 }, data: { name: 'proj', path: '~/proj', color: '#fff' } }
const CHAT = { id: 'c-1', type: 'chat', position: { x: 0, y: 0 }, data: { name: 'x', path: '~', sessionId: 's-1' } }

// O store do canvas lembra o que leu (cópia de segurança): cada teste é uma abertura do app.
// A Lixeira do sistema, aqui: o arquivo sai do lugar.
const open = async () => {
  vi.resetModules()
  const { shell } = await import('electron')
  const trashItem = vi.fn(async (path: string) => rmSync(path))
  Object.assign(shell, { trashItem })
  const { Boards } = await import('./boards')
  const changed = vi.fn()
  return { boards: new Boards(vi.fn(), changed), changed, trashItem }
}
const ids = (boards: { state: (wc: Electron.WebContents) => { boards: { id: string }[] } }) =>
  boards.state({ id: 1 } as Electron.WebContents).boards.map((b) => b.id)

beforeEach(() => {
  rmSync(dir(), { recursive: true, force: true })
  mkdirSync(dir(), { recursive: true })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('Boards', () => {
  it('quem atualiza encontra o canvas de antes como o primeiro workspace', async () => {
    writeFileSync(join(dir(), 'canvas.json'), JSON.stringify([FOLDER, CHAT]))
    const { boards } = await open()
    const { boards: list } = boards.state({ id: 1 } as Electron.WebContents)
    expect(list).toEqual([{ id: 'main', name: 'Principal', paths: ['~/proj'], sessions: ['s-1'] }])
    expect(boards.hub('main')?.load()).toEqual([FOLDER, CHAT])
  })

  it('workspace novo tem canvas próprio, gravado no arquivo dele, e a lista guarda o nome', async () => {
    writeFileSync(join(dir(), 'canvas.json'), JSON.stringify([FOLDER]))
    const { boards } = await open()
    const id = boards.create('Cliente X')
    boards.put(id, [CHAT])
    boards.flush()
    expect(read(join(dir(), 'boards', `${id}.json`))).toEqual([CHAT])
    expect(read(join(dir(), 'canvas.json'))).toEqual([FOLDER])
    expect(read(join(dir(), 'boards.json'))).toEqual([
      { id: 'main', name: 'Principal' },
      { id, name: 'Cliente X' }
    ])
  })

  // O ⌘Z do destino tiraria o bloco movido sem devolver ao de origem: um terminal ficaria rodando
  // sem card em nenhum workspace.
  it('blocos movidos de outro workspace não entram no desfazer do destino', async () => {
    const { boards } = await open()
    const id = boards.create('Destino')
    boards.put(id, [CHAT])
    boards.hub(id)?.undo()
    expect(boards.hub(id)?.load()).toEqual([CHAT])
  })

  it('cada workspace tem o próprio desfazer', async () => {
    const { boards } = await open()
    const id = boards.create('Outro')
    boards.hub('main')?.record()
    boards.hub('main')?.sync([FOLDER], null)
    boards.hub(id)?.record()
    boards.hub(id)?.sync([CHAT], null)
    boards.hub(id)?.undo()
    expect(boards.hub(id)?.load()).toBeNull()
    expect(boards.hub('main')?.load()).toEqual([FOLDER])
  })

  it('renomear sem nome não muda nada', async () => {
    const { boards } = await open()
    boards.rename('main', '   ')
    expect(boards.state({ id: 1 } as Electron.WebContents).boards[0].name).toBe('Principal')
  })

  it('fechar só tira do menu: o canvas continua, e reabrir traz de volta', async () => {
    const { boards } = await open()
    const id = boards.create('Cliente')
    boards.put(id, [CHAT])
    boards.close(id)
    expect(boards.state({ id: 1 } as Electron.WebContents).boards.find((b) => b.id === id)?.closed).toBe(true)
    expect(boards.hub(id)?.load()).toEqual([CHAT])
    boards.reopen(id)
    expect(boards.state({ id: 1 } as Electron.WebContents).boards.find((b) => b.id === id)?.closed).toBeUndefined()
  })

  it('aberto não se exclui: precisa fechar antes', async () => {
    const { boards } = await open()
    const id = boards.create('Cliente')
    boards.put(id, [CHAT])
    expect(boards.remove(id)).toEqual([])
    expect(boards.hub(id)?.load()).toEqual([CHAT])
  })

  it('excluir põe o canvas na Lixeira, devolve os blocos e não deixa gravar em outro no lugar', async () => {
    writeFileSync(join(dir(), 'canvas.json'), JSON.stringify([FOLDER]))
    const { boards, trashItem } = await open()
    const id = boards.create('Temporário')
    boards.put(id, [CHAT])
    boards.flush()
    boards.close(id)
    expect(boards.remove(id)).toEqual([CHAT])
    await vi.waitFor(() => expect(trashItem).toHaveBeenCalledWith(join(dir(), 'boards', `${id}.json`)))
    expect(existsSync(join(dir(), 'boards', `${id}.json`))).toBe(false)
    // Uma janela que ainda mostrava o excluído: o pedido dela não cai no primeiro.
    expect(boards.hub(id)).toBeUndefined()
    expect(boards.hub('main')?.load()).toEqual([FOLDER])
  })

  it('o último aberto não fecha', async () => {
    const { boards } = await open()
    boards.create('Outro')
    const other = ids(boards)[1]
    boards.close(other)
    boards.close('main')
    expect(boards.state({ id: 1 } as Electron.WebContents).boards.find((b) => b.id === 'main')?.closed).toBeUndefined()
  })

  it('a lista estragada volta pela cópia da última lista boa, e a estragada fica guardada ao lado', async () => {
    const first = await open()
    const id = first.boards.create('Cliente X')
    // Outra abertura: a primeira gravação dela guarda a lista boa como cópia.
    const second = await open()
    second.boards.rename(id, 'Cliente Y')
    writeFileSync(join(dir(), 'boards.json'), '[{"id": ')
    const { boards } = await open()
    expect(boards.state({ id: 1 } as Electron.WebContents).boards.map((b) => [b.id, b.name])).toEqual([
      ['main', 'Principal'],
      [id, 'Cliente X']
    ])
    expect(readdirSync(dir()).some((f) => f.startsWith('boards.corrompido-'))).toBe(true)
  })

  it('sem lista nem cópia, os canvas da pasta voltam como recuperados, sem apagar nada', async () => {
    mkdirSync(join(dir(), 'boards'), { recursive: true })
    writeFileSync(join(dir(), 'canvas.json'), JSON.stringify([FOLDER]))
    writeFileSync(join(dir(), 'boards', 'abc.json'), JSON.stringify([CHAT]))
    writeFileSync(join(dir(), 'boards.json'), '[{"id": ')
    const { boards } = await open()
    const list = boards.state({ id: 1 } as Electron.WebContents).boards
    expect(list.map((b) => [b.id, b.name])).toEqual([
      ['main', 'Principal'],
      ['abc', 'Workspace recuperado 1']
    ])
    expect(boards.hub('abc')?.load()).toEqual([CHAT])
  })

  it('canvas excluído não volta como recuperado', async () => {
    const first = await open()
    const id = first.boards.create('Temporário')
    first.boards.put(id, [CHAT])
    first.boards.flush()
    first.boards.close(id)
    first.boards.remove(id)
    await vi.waitFor(() => expect(first.trashItem).toHaveBeenCalled())
    const { boards } = await open()
    expect(ids(boards)).toEqual(['main'])
  })

  it('avisa as janelas quando um workspace ganha uma pasta, não a cada mudança', async () => {
    const { boards, changed } = await open()
    boards.put('main', [FOLDER])
    boards.put('main', [{ ...FOLDER, position: { x: 50, y: 50 } }])
    expect(changed).toHaveBeenCalledTimes(1)
    expect(changed.mock.calls[0][0][0].paths).toEqual(['~/proj'])
  })
})
