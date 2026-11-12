import { EventEmitter } from 'node:events'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { deserialize, serialize } from 'node:v8'
import { afterEach, describe, expect, it } from 'vitest'
import { TunnelClient } from './tunnelClient'
import { tunnelClose, tunnelData, tunnelOpen } from './tunnelHost'
import type { Page } from '../ipc/page'

// "Abrir localhost" pela janela de acesso remoto, de ponta a ponta: o navegador (fetch) entra pela
// porta do notebook, passa pelo túnel (aqui sem a ligação: as mensagens só passam pela cópia do V8,
// como passariam) e chega a um servidor de verdade no "de casa".

class FakePage extends EventEmitter {
  readonly id = 1_000_000_001
  deliver: (channel: string, args: unknown[]) => void = () => {}
  send(channel: string, ...args: unknown[]): void {
    const copy = deserialize(serialize(args)) as unknown[]
    setImmediate(() => this.deliver(channel, copy))
  }
  isDestroyed(): boolean {
    return false
  }
}

let server: Server | null = null
let client: TunnelClient | null = null

afterEach(async () => {
  client?.closeAll()
  client = null
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()))
  server = null
})

function wire(): { page: FakePage; client: TunnelClient } {
  const page = new FakePage()
  const tunnel = new TunnelClient((_w, ch, args) => {
    const copy = deserialize(serialize(args)) as unknown[]
    setImmediate(() => {
      const p = page as unknown as Page
      if (ch === 'tunnel:open') tunnelOpen(p, copy[0], copy[1])
      else if (ch === 'tunnel:data') tunnelData(p, copy[0], copy[1])
      else if (ch === 'tunnel:close') tunnelClose(p, copy[0])
    })
    return true
  })
  page.deliver = (ch, args) => tunnel.event(ch, args)
  return { page, client: tunnel }
}

async function serve(body: string): Promise<number> {
  server = createServer((_req, res) => res.end(body))
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()))
  return (server!.address() as AddressInfo).port
}

describe('túnel do localhost', () => {
  it('a página do servidor de lá abre pela porta daqui', async () => {
    const port = await serve('olá do outro computador')
    ;({ client } = wire())
    // A porta está ocupada "aqui" (o próprio servidor do teste): vai por outra.
    const local = await client.open(1, port)
    expect(local).not.toBe(port)
    const res = await fetch(`http://127.0.0.1:${local}/`)
    expect(await res.text()).toBe('olá do outro computador')
    // Pedir de novo devolve a mesma porta.
    expect(await client.open(1, port)).toBe(local)
  })

  it('várias conexões ao mesmo tempo', async () => {
    const port = await serve('ok')
    ;({ client } = wire())
    const local = await client.open(1, port)
    const bodies = await Promise.all(Array.from({ length: 5 }, () => fetch(`http://127.0.0.1:${local}/`, { headers: { connection: 'close' } }).then((r) => r.text())))
    expect(bodies).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
  })

  it('fechar a janela fecha a porta daqui', async () => {
    const port = await serve('ok')
    ;({ client } = wire())
    const local = await client.open(1, port)
    client.closeWindow(1)
    await expect(fetch(`http://127.0.0.1:${local}/`)).rejects.toThrow()
  })
})
