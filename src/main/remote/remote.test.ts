import { EventEmitter } from 'node:events'
import { serialize } from 'node:v8'
import type { BrowserWindow } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { broadcast } from '../ipc/events'
import { isRemotePage, type Caller, type Page } from '../ipc/page'
import { handle, on, onSync } from '../ipc/register'
import { RemoteClient } from './client'
import { RemoteHost } from './host'
import { memoryLinks } from './link'
import { blockedReply, channelPolicy } from './policy'
import { decodeClient, encode, type ClientMessage } from './protocol'

// Acesso remoto: o notebook (RemoteClient) pede ao Argus de casa (RemoteHost) pelos mesmos
// handlers das janelas, numa ligação na memória. O que não pode quebrar: a resposta voltar para o
// pedido certo, o aviso chegar à janela certa, o de casa recusar o que não é liberado e nada ficar
// pendurado quando a janela fecha ou a ligação cai.

const VERSION = '1.2.3'
const INFO = { name: 'casa', platform: 'darwin', homeDir: '/Users/ana', windowsBuild: null, version: VERSION }

// O que os handlers de teste viram (quem chamou e os argumentos).
const seen: { caller: Page; args: unknown[] }[] = []
const record = (e: Caller, ...args: unknown[]) => void seen.push({ caller: e.sender, args })

handle('sessions:list', (e, path) => {
  record(e, path)
  return [{ id: 's1', title: path } as never]
})
handle('transcription:transcribe', (e, samples) => {
  record(e, samples)
  return `${samples.length} amostras`
})
handle('sessions:trash', () => {
  throw new Error('não deu para apagar')
})
handle('dialog:pickFolders', () => ['/não/devia/chegar'])
on('chat:interrupt', (e, key) => record(e, key))
onSync('boards:create', (_e, name) => `id-${name}`)

// Uma janela do notebook: só o que o RemoteClient usa do webContents.
function fakeWindow(id: number) {
  const wc = Object.assign(new EventEmitter(), {
    id,
    sent: [] as [string, ...unknown[]][],
    send(channel: string, ...args: unknown[]) {
      this.sent.push([channel, ...args])
    },
    isDestroyed: () => false
  })
  return { win: { webContents: wc } as unknown as BrowserWindow, wc }
}

const tick = () => new Promise((r) => setImmediate(r))
const settle = async () => {
  for (let i = 0; i < 5; i++) await tick()
}

async function connect(version = VERSION) {
  const [hostSide, clientSide] = memoryLinks()
  const host = new RemoteHost(() => INFO)
  host.accept(hostSide)
  const client = new RemoteClient(clientSide, version, 'notebook')
  return { host, client, clientSide }
}

async function connected(windowId = 7) {
  const parts = await connect()
  await parts.client.connect()
  const { win, wc } = fakeWindow(windowId)
  parts.client.attach(win)
  return { ...parts, wc, route: parts.client.routeFor(windowId) }
}

describe('acesso remoto', () => {
  it('apresenta o computador de casa a quem conecta', async () => {
    const { client } = await connect()
    await expect(client.connect()).resolves.toEqual(INFO)
  })

  it('recusa versão diferente, com o motivo para mostrar', async () => {
    const { client } = await connect('9.9.9')
    await expect(client.connect()).rejects.toThrow(/Versões diferentes.*1\.2\.3.*9\.9\.9/)
  })

  it('responde o pedido pelo handler de casa, com a janela de lá como quem chamou', async () => {
    seen.length = 0
    const { route } = await connected()
    await expect(route.call('invoke', 'sessions:list', ['/proj'])).resolves.toEqual([{ id: 's1', title: '/proj' }])
    expect(isRemotePage(seen[0].caller)).toBe(true)
  })

  it('leva Float32Array como o IPC do Electron', async () => {
    seen.length = 0
    const { route } = await connected()
    const samples = new Float32Array([0.5, -0.25, 1])
    await expect(route.call('invoke', 'transcription:transcribe', [samples])).resolves.toBe('3 amostras')
    expect(seen[0].args[0]).toBeInstanceOf(Float32Array)
    expect([...(seen[0].args[0] as Float32Array)]).toEqual([0.5, -0.25, 1])
  })

  it('erro no handler de casa volta como promessa rejeitada', async () => {
    const { route } = await connected()
    await expect(route.call('invoke', 'sessions:trash', ['/proj', 's1'])).rejects.toThrow('não deu para apagar')
  })

  it('o de casa recusa canal bloqueado mesmo se o notebook pedir', async () => {
    const { route } = await connected()
    await expect(route.call('invoke', 'dialog:pickFolders', [])).rejects.toThrow(/recusado/)
  })

  it('pedido síncrono e mensagem sem resposta chegam', async () => {
    seen.length = 0
    const { route } = await connected()
    await expect(route.call('sync', 'boards:create', ['novo'])).resolves.toBe('id-novo')
    await route.call('send', 'chat:interrupt', ['k1'])
    await settle()
    expect(seen.map((s) => s.args)).toEqual([['k1']])
  })

  it('aviso de casa chega à janela do notebook', async () => {
    const { wc } = await connected()
    await settle()
    broadcast('chat:active', [])
    await settle()
    expect(wc.sent).toContainEqual(['chat:active', []])
  })

  it('recarregar e fechar a janela soltam o que ela segurava em casa', async () => {
    seen.length = 0
    const { route, wc } = await connected()
    await route.call('invoke', 'sessions:list', ['/proj'])
    const page = seen[0].caller
    const navigated = vi.fn()
    const destroyed = vi.fn()
    page.on('did-navigate', navigated)
    page.on('destroyed', destroyed)
    wc.emit('did-navigate')
    await settle()
    expect(navigated).toHaveBeenCalledOnce()
    wc.emit('destroyed')
    await settle()
    expect(destroyed).toHaveBeenCalledOnce()
    expect(page.isDestroyed()).toBe(true)
  })

  it('ligação caída: nada fica pendurado e a janela fica sabendo', async () => {
    const { route, wc, clientSide, client } = await connected()
    clientSide.close()
    await settle()
    expect(client.state).toBe('closed')
    expect(wc.sent).toContainEqual(['remote:state', 'closed'])
    await expect(route.call('invoke', 'sessions:list', ['/proj'])).rejects.toThrow(/Sem ligação/)
    await expect(route.call('sync', 'boards:create', ['x'])).resolves.toBeNull()
  })

  it('pedido em andamento quando a ligação cai é rejeitado', async () => {
    const { route, clientSide } = await connected()
    const pending = route.call('invoke', 'sessions:list', ['/proj'])
    clientSide.close()
    await expect(pending).rejects.toThrow(/Sem ligação/)
  })
})

describe('desconectar pelo computador de casa', () => {
  it('a janela fica sabendo e o notebook não tenta religar', async () => {
    const [hostSide, clientSide] = memoryLinks()
    const session = new RemoteHost(() => INFO).accept(hostSide)
    const reconnect = vi.fn(async () => memoryLinks()[1])
    const client = new RemoteClient(clientSide, VERSION, 'notebook', reconnect)
    await client.connect()
    const { win, wc } = fakeWindow(9)
    client.attach(win)
    await settle()
    session.kick()
    await settle()
    expect(client.state).toBe('kicked')
    expect(wc.sent).toContainEqual(['remote:state', 'kicked'])
    await new Promise((r) => setTimeout(r, 1200))
    expect(reconnect).not.toHaveBeenCalled()
  })
})

describe('mensagens do notebook', () => {
  it('passa só o formato esperado', () => {
    const ok: ClientMessage = { t: 'call', w: 1, id: 2, kind: 'invoke', ch: 'sessions:list', args: ['/x'] }
    expect(decodeClient(encode(ok))).toEqual(ok)
    expect(decodeClient(serialize({ ...ok, kind: 'eval' }))).toBeNull()
    expect(decodeClient(serialize({ ...ok, args: 'x' }))).toBeNull()
    expect(decodeClient(serialize({ t: 'open', w: '1' }))).toBeNull()
    expect(decodeClient(serialize({ t: 'outra' }))).toBeNull()
    expect(decodeClient(Buffer.from('lixo'))).toBeNull()
  })
})

describe('política dos canais', () => {
  it('tema e zoom ficam no notebook; seletor de pastas e ditado bloqueados; o resto vai para casa', () => {
    expect(channelPolicy('theme:set')).toBe('local')
    expect(channelPolicy('interface:zoom')).toBe('local')
    expect(channelPolicy('dialog:pickFolder')).toBe('blocked')
    expect(channelPolicy('speech:start')).toBe('blocked')
    expect(channelPolicy('files:reveal')).toBe('blocked')
    expect(channelPolicy('chat:send')).toBe('remote')
    expect(channelPolicy('terminal:write')).toBe('remote')
  })

  it('pedido bloqueado recebe a resposta vazia do tipo dele', () => {
    expect(blockedReply('dialog:pickFolders')).toEqual([])
    expect(blockedReply('dialog:pickFolder')).toBeNull()
    expect(blockedReply('files:paste')).toMatchObject({ ok: false })
  })
})
