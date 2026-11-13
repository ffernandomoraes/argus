import { DurableObject } from 'cloudflare:workers'

// Ponte do acesso remoto do Argus (ver apps/desktop/src/main/remote no app). Liga o Argus de casa aos aparelhos
// pareados quando os dois estão atrás de roteadores diferentes. Só repassa bytes: tudo vai cifrado
// de ponta a ponta pelo app, e nada daqui permite ler nem se passar por um dos lados.
//
// Rotas (todas WebSocket):
// - /host/<hostId>: o Argus de casa, com `Authorization: Bearer <chave>`. A primeira conexão grava o
//   hash da chave; depois, só quem tem a mesma chave ocupa a sala.
// - /client/<hostId>: um aparelho. Recebe um número; o de casa recebe `{t:'open', c}` e as
//   mensagens dele com o número na frente (4 bytes).
// - /pair/<nameplate>?role=host|client: o pareamento, uma dupla por vez, por até 10 minutos.
//
// Os arquivos de public/ (o app do celular, montado de mobile/) são servidos antes de chegar aqui.

interface Env {
  ROOM: DurableObjectNamespace<Room>
}

const MAX_CLIENTS = 8
// Conexão de aparelho que o de casa ainda não autenticou: depois disto, ou com a sala cheia, sai
// (senão quem soubesse o endereço da sala lotaria as vagas e o aparelho de verdade não entraria).
const PENDING_MS = 30_000

type ClientState = { at: number; authed: boolean }
const OPEN = 1
const PAIR_TTL_MS = 10 * 60 * 1000
// Mensagem de aparelho maior que isto é recusada (o app manda em pedaços de 256 KiB).
const MAX_FRAME = 512 * 1024

const text = (body: string, status: number) => new Response(body, { status })

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function upgrade(accept: (server: WebSocket) => void): Response {
  const { 0: client, 1: server } = new WebSocketPair()
  accept(server)
  return new Response(null, { status: 101, webSocket: client })
}

const byteLength = (m: ArrayBuffer | string) => (typeof m === 'string' ? m.length : m.byteLength)

export class Room extends DurableObject<Env> {
  // As conexões do de casa, da mais nova para a mais antiga. A de antes, fechada daqui quando ele
  // religou, continua na lista (e "aberta") até o outro lado confirmar o fechamento, o que não
  // acontece se o processo morreu (o Argus reiniciado): mandar nela quebra com "send() after close()".
  private hosts(): WebSocket[] {
    const at = (ws: WebSocket) => (ws.deserializeAttachment() as { at?: number } | null)?.at ?? 0
    return this.ctx
      .getWebSockets('host')
      .filter((ws) => ws.readyState === OPEN)
      .sort((a, b) => at(b) - at(a))
  }

  private host(): WebSocket | undefined {
    return this.hosts()[0]
  }

  // Manda ao de casa pela conexão mais nova que aceitar; nenhuma: falso.
  private sendToHost(data: string | ArrayBuffer | Uint8Array): boolean {
    for (const ws of this.hosts()) {
      try {
        ws.send(data)
        return true
      } catch {
        closeQuietly(ws, 4000, 'replaced')
      }
    }
    return false
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return text('expected websocket', 426)
    const url = new URL(request.url)
    const kind = url.pathname.split('/')[1]
    if (kind === 'host') return this.acceptHost(request)
    if (kind === 'client') return this.acceptClient()
    if (kind === 'pair') return this.acceptPair(url.searchParams.get('role'))
    return text('not found', 404)
  }

  private async acceptHost(request: Request): Promise<Response> {
    const key = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (key.length < 32 || key.length > 256) return text('unauthorized', 401)
    const hash = await sha256Hex(key)
    const stored = await this.ctx.storage.get<string>('keyHash')
    if (stored && stored !== hash) return text('forbidden', 403)
    if (!stored) await this.ctx.storage.put('keyHash', hash)
    // A conexão nova do de casa vale; as de antes (e os aparelhos ligados a ela) saem.
    for (const old of this.ctx.getWebSockets('host')) closeQuietly(old, 4000, 'replaced')
    for (const c of this.ctx.getWebSockets('client')) closeQuietly(c, 4001, 'host-gone')
    return upgrade((server) => {
      this.ctx.acceptWebSocket(server, ['host'])
      server.serializeAttachment({ at: Date.now() })
    })
  }

  private acceptClient(): Response {
    const host = this.host()
    if (!host) return text('host offline', 404)
    const now = Date.now()
    const pending = (ws: WebSocket) => !(ws.deserializeAttachment() as ClientState | null)?.authed
    const clients = this.ctx.getWebSockets('client').filter((ws) => ws.readyState === OPEN)
    for (const ws of clients) {
      const state = ws.deserializeAttachment() as ClientState | null
      if (pending(ws) && now - (state?.at ?? 0) > PENDING_MS) ws.close(4003, 'unauthenticated')
    }
    const live = clients.filter((ws) => ws.readyState === OPEN)
    if (live.length >= MAX_CLIENTS) {
      // Cheia: sai a mais antiga que não autenticou; todas autenticadas, recusa.
      const oldest = live.filter(pending).sort((a, b) => (a.deserializeAttachment() as ClientState).at - (b.deserializeAttachment() as ClientState).at)[0]
      if (!oldest) return text('too many', 429)
      oldest.close(4003, 'unauthenticated')
    }
    let id = 0
    do id = crypto.getRandomValues(new Uint32Array(1))[0]
    while (!id || this.ctx.getWebSockets(`c:${id}`).length)
    const response = upgrade((server) => {
      this.ctx.acceptWebSocket(server, ['client', `c:${id}`])
      server.serializeAttachment({ at: now, authed: false } satisfies ClientState)
    })
    if (!this.sendToHost(JSON.stringify({ t: 'open', c: id }))) {
      for (const ws of this.ctx.getWebSockets(`c:${id}`)) closeQuietly(ws, 4001, 'host-gone')
      return text('host offline', 404)
    }
    return response
  }

  private async acceptPair(role: string | null): Promise<Response> {
    if (role === 'host') {
      if (this.ctx.getWebSockets('pair-host').length) return text('taken', 409)
      await this.ctx.storage.setAlarm(Date.now() + PAIR_TTL_MS)
      return upgrade((server) => this.ctx.acceptWebSocket(server, ['pair-host']))
    }
    if (role === 'client') {
      if (!this.ctx.getWebSockets('pair-host').length) return text('no pairing', 404)
      if (this.ctx.getWebSockets('pair-client').length) return text('taken', 409)
      return upgrade((server) => this.ctx.acceptWebSocket(server, ['pair-client']))
    }
    return text('bad role', 400)
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const tags = this.ctx.getTags(ws)
    if (byteLength(message) > MAX_FRAME) return ws.close(1009, 'too big')

    if (tags.includes('host')) {
      if (typeof message === 'string') {
        const m = JSON.parse(message) as { t?: unknown; c?: unknown }
        if (typeof m.c !== 'number') return
        const client = this.ctx.getWebSockets(`c:${m.c}`)[0]
        if (m.t === 'close') client?.close(1000, 'closed')
        // O de casa conferiu a chave do aparelho: a conexão não sai mais por falta de autenticação.
        else if (m.t === 'auth') client?.serializeAttachment({ ...(client.deserializeAttachment() as ClientState), authed: true } satisfies ClientState)
        return
      }
      if (message.byteLength < 4) return
      const id = new DataView(message).getUint32(0)
      this.ctx.getWebSockets(`c:${id}`)[0]?.send(message.slice(4))
      return
    }

    if (tags.includes('client')) {
      if (typeof message === 'string') return ws.close(1003, 'binary only')
      const frame = new Uint8Array(4 + message.byteLength)
      new DataView(frame.buffer).setUint32(0, clientId(tags))
      frame.set(new Uint8Array(message), 4)
      if (!this.sendToHost(frame)) ws.close(4001, 'host-gone')
      return
    }

    const other = tags.includes('pair-host') ? 'pair-client' : 'pair-host'
    this.ctx.getWebSockets(other)[0]?.send(message)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.gone(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.gone(ws)
  }

  private gone(ws: WebSocket): void {
    const tags = this.ctx.getTags(ws)
    try {
      ws.close(1000, 'bye')
    } catch {
      // já fechado
    }
    if (tags.includes('host')) {
      // A antiga saindo depois de o de casa já ter religado: os aparelhos são da nova, ficam.
      if (!this.host()) for (const c of this.ctx.getWebSockets('client')) closeQuietly(c, 4001, 'host-gone')
    } else if (tags.includes('client')) {
      this.sendToHost(JSON.stringify({ t: 'close', c: clientId(tags) }))
    } else {
      // Pareamento: acabou para os dois.
      for (const t of ['pair-host', 'pair-client']) for (const s of this.ctx.getWebSockets(t)) if (s !== ws) s.close(1000, 'pair-over')
    }
  }

  async alarm(): Promise<void> {
    for (const t of ['pair-host', 'pair-client']) for (const s of this.ctx.getWebSockets(t)) s.close(4002, 'expired')
  }
}

function closeQuietly(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason)
  } catch {
    // já fechada
  }
}

function clientId(tags: string[]): number {
  const tag = tags.find((t) => t.startsWith('c:'))
  return tag ? Number(tag.slice(2)) : 0
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/') return text('Argus relay', 200)
    const m = /^\/(host|client|pair)\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname)
    if (!m) return text('not found', 404)
    const [, kind, id] = m
    if (kind === 'pair' ? !/^[0-9A-HJKMNP-TV-Z]{5}$/.test(id) : !/^[A-Za-z0-9_-]{22,64}$/.test(id)) return text('bad id', 400)
    const name = kind === 'pair' ? `pair:${id}` : `host:${id}`
    return env.ROOM.get(env.ROOM.idFromName(name)).fetch(request)
  }
} satisfies ExportedHandler<Env>
