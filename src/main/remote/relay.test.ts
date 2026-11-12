import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { handle } from '../ipc/register'
import { RemoteClient } from './client'
import { acceptSession, openSession, pairAsClient, pairAsHost } from './handshake'
import { RemoteHost } from './host'
import { newPairCode } from './crypto'
import { connectPairing, connectToHost, HostRelay, RelayError } from './relay'

// O caminho inteiro pela ponte de verdade (WebSocket, Durable Object): pareamento, conexão,
// pedido e aparelho desconhecido. Só roda com a ponte no ar:
//   cd relay && wrangler dev --port 8787
//   RELAY_TEST_URL=ws://127.0.0.1:8787 pnpm vitest run src/main/remote/relay.test.ts

// test/setup.ts tira as ARGUS_* do ambiente: o endereço vem por outra variável.
const RELAY = process.env.RELAY_TEST_URL
if (RELAY) process.env.ARGUS_RELAY_URL = RELAY
const INFO = { name: 'casa', platform: 'darwin', homeDir: '/Users/ana', windowsBuild: null, version: '1.0.0' }

handle('sessions:folders', () => [{ path: '/Users/ana/proj', updatedAt: null } as never])

const relays: HostRelay[] = []
afterAll(() => relays.forEach((r) => r.stop()))

const until = async (check: () => boolean, ms = 5000) => {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('tempo esgotado')
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe.skipIf(!RELAY)('ponte de verdade', () => {
  it('pareia, conecta e responde um pedido pela ponte', async () => {
    const code = { ...newPairCode(), secret: '123456' }
    const hostId = randomBytes(24).toString('base64url')
    const hostKey = randomBytes(32).toString('base64url')

    // Pareamento pela vaga do código.
    const hostPair = await connectPairing(code.nameplate, 'host')
    const clientPair = await connectPairing(code.nameplate, 'client')
    const [granted, received] = await Promise.all([
      pairAsHost(hostPair, code, (name, psk) => ({ hostId, hostName: 'casa', deviceId: `dev-${name}`, psk })),
      pairAsClient(clientPair, code, 'notebook')
    ])
    hostPair.close()
    clientPair.close()
    expect(received.psk.equals(granted.psk)).toBe(true)

    // O de casa na sala dele.
    const host = new RemoteHost(() => INFO)
    let status = ''
    const relay = new HostRelay(
      hostId,
      hostKey,
      (raw) =>
        void acceptSession(raw, (id) => (id === received.deviceId ? granted.psk : null)).then(
          ({ link }) => host.accept(link),
          () => {}
        ),
      (s) => (status = s)
    )
    relays.push(relay)
    relay.start()
    await until(() => status === 'online')

    // O notebook entra e pede.
    const link = await openSession(await connectToHost(hostId), received.deviceId, received.psk)
    const client = new RemoteClient(link, '1.0.0', 'notebook')
    await expect(client.connect()).resolves.toMatchObject({ name: 'casa' })
    const fake = { webContents: Object.assign(new (await import('node:events')).EventEmitter(), { id: 3, send: () => {}, isDestroyed: () => false }) }
    client.attach(fake as never)
    await expect(client.routeFor(3).call('invoke', 'sessions:folders', [])).resolves.toEqual([{ path: '/Users/ana/proj', updatedAt: null }])
    client.close()
  }, 30_000)

  it('aparelho sem a chave não entra; sala sem o de casa avisa que está desligado', async () => {
    const hostId = randomBytes(24).toString('base64url')
    await expect(connectToHost(hostId)).rejects.toMatchObject({ reason: 'offline' })
    expect(new RelayError('offline').userMessage).toMatch(/desligado/)

    let status = ''
    const relay = new HostRelay(hostId, randomBytes(32).toString('base64url'), (raw) => void acceptSession(raw, () => null).catch(() => {}), (s) => (status = s))
    relays.push(relay)
    relay.start()
    await until(() => status === 'online')
    await expect(openSession(await connectToHost(hostId), 'intruso', randomBytes(32))).rejects.toMatchObject({ reason: 'unknown-device' })
  }, 30_000)

  it('outra chave não toma a sala do de casa', async () => {
    const hostId = randomBytes(24).toString('base64url')
    let first = ''
    const owner = new HostRelay(hostId, randomBytes(32).toString('base64url'), () => {}, (s) => (first = s))
    relays.push(owner)
    owner.start()
    await until(() => first === 'online')
    let second = ''
    const squatter = new HostRelay(hostId, randomBytes(32).toString('base64url'), () => {}, (s) => (second = s))
    relays.push(squatter)
    squatter.start()
    await until(() => second === 'offline' || second === 'online')
    await new Promise((r) => setTimeout(r, 500))
    expect(second).not.toBe('online')
    expect(first).toBe('online')
  }, 30_000)
})

describe.skipIf(!RELAY)('serviço do acesso remoto pela ponte', () => {
  it('gera código, pareia, abre e, removido o aparelho, não entra mais', async () => {
    const { RemoteAccess } = await import('./access')
    const { EventEmitter } = await import('node:events')
    const states: string[] = []
    let opened = 0
    const access = new RemoteAccess({
      hostName: () => 'casa',
      hostInfo: () => ({ ...INFO, version: '0.0.0-test' }),
      openWindow: async (client) => {
        opened++
        client.attach({ webContents: Object.assign(new EventEmitter(), { id: 50 + opened, send: () => {}, isDestroyed: () => false }) } as never)
      },
      focus: () => {},
      onChange: (s) => states.push(s.relay)
    })
    // O mesmo computador faz os dois papéis: gera o código e digita.
    access.startPairing()
    await until(() => access.state().pairing !== null && access.state().relay === 'online', 10_000)
    const code = access.state().pairing!.code
    const paired = await access.pair(code)
    expect(paired).toMatchObject({ ok: true, name: 'casa' })
    await until(() => access.state().pairingResult?.ok === true)
    expect(access.state().devices).toHaveLength(1)
    expect(access.state().hosts).toHaveLength(1)

    const hostId = access.state().hosts[0].hostId
    await expect(access.open(hostId)).resolves.toBeNull()
    expect(opened).toBe(1)
    await until(() => access.state().devices[0].connected)

    // Código errado não pareia.
    access.startPairing()
    await until(() => access.state().pairing !== null)
    const wrong = access.state().pairing!.code.replace(/\d$/, (d) => String((Number(d) + 1) % 10))
    await expect(access.pair(wrong)).resolves.toMatchObject({ ok: false })
    await until(() => access.state().pairing === null)
    expect(access.state().devices).toHaveLength(1)

    // Removido, o aparelho é derrubado e não entra de novo.
    access.forgetHost(hostId)
    const deviceId = access.state().devices[0].id
    access.removeDevice(deviceId)
    expect(access.state().devices).toHaveLength(0)
    access.shutdown()
  }, 60_000)
})
