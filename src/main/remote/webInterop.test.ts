import { describe, expect, it, vi } from 'vitest'
import { pairAsClient as webPair, openSession as webOpen, HandshakeError as WebHandshakeError } from '../../../mobile/src/net/handshake'
import { parsePairCode as webParse, type Link as WebLink } from '../../../mobile/src/net/crypto'
import { broadcast } from '../ipc/events'
import { handle, on, onSync } from '../ipc/register'
import { decodeWeb, encodeWeb, WEB_PROTOCOL_VERSION, type WebHostInfo } from '../../shared/webRemote'
import { newPairCode, formatPairCode } from './crypto'
import { acceptSession, pairAsHost } from './handshake'
import { memoryLinks, type Link } from './link'
import { WebHostSession, validPushSubscription } from './webHost'

// O app do celular (mobile/src/net) com o lado de casa de verdade (handshake.ts, webHost.ts), numa
// ligação na memória: a criptografia do navegador tem que dar os mesmos bytes que a do app.

const tick = () => new Promise((r) => setImmediate(r))
const settle = async () => {
  for (let i = 0; i < 20; i++) await tick()
}

// A ligação da memória fala Buffer; a do navegador, Uint8Array (o Buffer é um Uint8Array).
const asWeb = (link: Link): WebLink => ({
  send: (d) => link.send(Buffer.from(d)),
  onMessage: (cb) => link.onMessage(cb),
  onClose: (cb) => link.onClose(cb),
  close: () => link.close()
})

async function pair() {
  const code = newPairCode()
  const [hostSide, clientSide] = memoryLinks()
  const kinds: string[] = []
  const hostDone = pairAsHost(hostSide, code, (name, psk, kind) => {
    kinds.push(`${name}:${kind}`)
    return { hostId: 'host-1', hostName: 'casa', deviceId: 'dev-1', psk }
  })
  const parsed = webParse(formatPairCode(code).toLowerCase())
  expect(parsed).toEqual(code)
  const [host, web] = await Promise.all([hostDone, webPair(asWeb(clientSide), parsed!, 'iPhone')])
  return { host, web, kinds }
}

describe('app do celular com o Argus de casa', () => {
  it('pareia com o mesmo código e chega à mesma chave', async () => {
    const { host, web, kinds } = await pair()
    expect(kinds).toEqual(['iPhone:web'])
    expect(web.hostId).toBe('host-1')
    expect(web.deviceId).toBe('dev-1')
    expect(Buffer.from(web.psk).equals(host.psk)).toBe(true)
  })

  it('pareia mesmo com o de casa fechando a ligação logo depois de entregar (como em access.ts)', async () => {
    const code = newPairCode()
    const [hostSide, clientSide] = memoryLinks()
    const hostDone = pairAsHost(hostSide, code, (_name, psk) => ({ hostId: 'host-1', hostName: 'casa', deviceId: 'dev-1', psk })).finally(() => hostSide.close())
    const [host, web] = await Promise.all([hostDone, webPair(asWeb(clientSide), code, 'iPhone')])
    expect(Buffer.from(web.psk).equals(host.psk)).toBe(true)
  })

  it('código errado não pareia', async () => {
    const code = newPairCode()
    const [hostSide, clientSide] = memoryLinks()
    const hostDone = pairAsHost(hostSide, code, () => {
      throw new Error('não devia parear')
    }).catch((e: unknown) => e)
    const wrong = { ...code, secret: code.secret === '000000' ? '111111' : '000000' }
    await expect(webPair(asWeb(clientSide), wrong, 'iPhone')).rejects.toBeInstanceOf(WebHandshakeError)
    expect(await hostDone).toBeInstanceOf(Error)
  })

  it('conecta e troca mensagens cifradas nos dois sentidos, inclusive grandes', async () => {
    const { host, web } = await pair()
    const [hostSide, clientSide] = memoryLinks()
    const [accepted, link] = await Promise.all([
      acceptSession(hostSide, (id) => (id === 'dev-1' ? host.psk : null)),
      webOpen(asWeb(clientSide), web.deviceId, web.psk)
    ])
    expect(accepted.deviceId).toBe('dev-1')

    const atHome: Buffer[] = []
    const atPhone: Uint8Array[] = []
    accepted.link.onMessage((d) => atHome.push(d))
    link.onMessage((d) => atPhone.push(d))

    const big = new Uint8Array(700 * 1024).map((_, i) => i % 251)
    link.send(new TextEncoder().encode('oi de longe'))
    link.send(big)
    accepted.link.send(Buffer.from('oi de casa'))
    accepted.link.send(Buffer.from(big))
    await settle()

    expect(atHome.map((d) => d.length)).toEqual([11, big.length])
    expect(atHome[0].toString()).toBe('oi de longe')
    expect(Buffer.from(atHome[1]).equals(Buffer.from(big))).toBe(true)
    expect(atPhone.map((d) => d.length)).toEqual([10, big.length])
    expect(new TextDecoder().decode(atPhone[0])).toBe('oi de casa')
    expect(Buffer.from(atPhone[1]).equals(Buffer.from(big))).toBe(true)
  })

  it('aparelho com a chave errada não entra', async () => {
    const { host, web } = await pair()
    const [hostSide, clientSide] = memoryLinks()
    const wrong = new Uint8Array(32).fill(7)
    const hostDone = acceptSession(hostSide, () => host.psk).catch((e: unknown) => e)
    await expect(webOpen(asWeb(clientSide), web.deviceId, wrong)).rejects.toBeInstanceOf(WebHandshakeError)
    expect(await hostDone).toBeInstanceOf(Error)
  })
})

// --- O "porteiro" do aparelho web ---

const INFO: WebHostInfo = { name: 'casa', platform: 'darwin', homeDir: '/Users/ana', windowsBuild: null, version: '1.0.0', pushKey: 'chave' }

handle('usage:get', () => ({ main: { session: null, weekly: null, models: [], updatedAt: 1 } }))
handle('files:upload', (_e, name, data) => ({ ok: true, path: `/tmp/${name}:${data.length}` }) as never)
handle('sessions:trash', () => 'não devia chegar')
on('chat:interrupt', () => {})
onSync('boards:state', () => ({ boards: [], current: 'b1' }))

function webSession() {
  const [hostSide, clientSide] = memoryLinks()
  const pushes: unknown[] = []
  let ended = false
  const session = new WebHostSession(hostSide, { info: () => INFO, push: (s) => void pushes.push(s), pushTest: async () => 'none', onEnd: () => (ended = true) })
  const received: Record<string, unknown>[] = []
  clientSide.onMessage((d) => {
    const m = decodeWeb(d)
    if (m) received.push(m)
  })
  const send = (m: Parameters<typeof encodeWeb>[0]) => clientSide.send(Buffer.from(encodeWeb(m)))
  return { session, send, received, pushes, ended: () => ended, clientSide }
}

describe('porteiro do aparelho web', () => {
  it('cumprimenta, atende os canais liberados e recusa o resto', async () => {
    const s = webSession()
    s.send({ t: 'hello', protocol: WEB_PROTOCOL_VERSION })
    await settle()
    expect(s.received[0]).toEqual({ t: 'welcome', info: INFO })

    s.send({ t: 'call', id: 1, ch: 'usage:get', args: [] })
    s.send({ t: 'call', id: 2, ch: 'boards:state', args: [] })
    s.send({ t: 'call', id: 3, ch: 'files:upload', args: ['a.txt', new Uint8Array([1, 2, 3])] })
    s.send({ t: 'call', id: 4, ch: 'sessions:trash', args: ['/x', 'y'] })
    s.send({ t: 'call', id: 5, ch: 'chat:interrupt', args: ['k'] })
    await settle()
    const reply = (id: number) => s.received.find((m) => m.t === 'reply' && m.id === id)
    expect(reply(1)).toMatchObject({ ok: true, value: { main: { updatedAt: 1 } } })
    expect(reply(2)).toMatchObject({ ok: true, value: { current: 'b1' } })
    expect(reply(3)).toMatchObject({ ok: true, value: { path: '/tmp/a.txt:3' } })
    expect(reply(4)).toMatchObject({ ok: false })
    expect(reply(5)).toMatchObject({ ok: true })
  })

  it('só repassa os avisos da lista', async () => {
    const s = webSession()
    s.send({ t: 'hello', protocol: WEB_PROTOCOL_VERSION })
    await settle()
    broadcast('chat:active', [])
    broadcast('terminal:data', 'k', 'segredo')
    broadcast('canvas:remote', 'b1', [])
    broadcast('boards:changed', [])
    await settle()
    const events = s.received.filter((m) => m.t === 'event').map((m) => m.ch)
    expect(events).toEqual(['chat:active', 'boards:changed'])
    s.session.close()
  })

  it('manda o estado só das conversas abertas no celular, no máximo a cada 250 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const s = webSession()
      s.send({ t: 'hello', protocol: WEB_PROTOCOL_VERSION })
      s.send({ t: 'call', id: 1, ch: 'chat:retain', args: ['aberta'] })
      await settle()
      const state = (partial: string) => ({ status: 'running', partial, permissions: [], revision: 0, turnTokens: 0, agents: [], backgroundTasks: 0 }) as never
      broadcast('chat:state', 'outra', state('x'))
      for (const p of ['a', 'ab', 'abc']) broadcast('chat:state', 'aberta', state(p))
      await settle()
      const partials = () => s.received.filter((m) => m.t === 'event' && m.ch === 'chat:state').map((m) => [(m.args as [string, { partial: string }])[0], (m.args as [string, { partial: string }])[1].partial])
      expect(partials()).toEqual([['aberta', 'a']])
      vi.advanceTimersByTime(260)
      await settle()
      expect(partials()).toEqual([
        ['aberta', 'a'],
        ['aberta', 'abc']
      ])
      s.session.close()
    } finally {
      vi.useRealTimers()
    }
  })

  it('recusa versão diferente e pedido antes do cumprimento', async () => {
    const a = webSession()
    a.send({ t: 'hello', protocol: WEB_PROTOCOL_VERSION + 1 })
    await settle()
    expect(a.received[0]?.t).toBe('reject')
    expect(a.ended()).toBe(true)

    const b = webSession()
    b.send({ t: 'call', id: 1, ch: 'usage:get', args: [] })
    await settle()
    expect(b.received).toEqual([])
    expect(b.ended()).toBe(true)
  })

  it('guarda só inscrição de notificação de serviço conhecido', async () => {
    const s = webSession()
    s.send({ t: 'hello', protocol: WEB_PROTOCOL_VERSION })
    s.send({ t: 'push', sub: { endpoint: 'https://web.push.apple.com/abc', p256dh: 'x', auth: 'y' } })
    s.send({ t: 'push', sub: { endpoint: 'https://evil.example.com/abc', p256dh: 'x', auth: 'y' } })
    s.send({ t: 'push', sub: null })
    await settle()
    expect(s.pushes).toEqual([{ endpoint: 'https://web.push.apple.com/abc', p256dh: 'x', auth: 'y' }, null])
    expect(validPushSubscription({ endpoint: 'http://web.push.apple.com/x', p256dh: 'x', auth: 'y' })).toBeNull()
  })
})
