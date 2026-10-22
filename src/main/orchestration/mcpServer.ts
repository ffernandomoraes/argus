import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { z } from 'zod'
import { DELEGATE_TOOL, LIST_AGENTS_TOOL, REPORT_VALIDATION_TOOL } from '../../shared/orchestrator'
import { callTool, delegateShape, reportShape, TOOL_DESCRIPTIONS } from './tools'
import type { StepHost } from './types'

// Servidor MCP local (HTTP em 127.0.0.1) com as ferramentas do orquestrador, para o Codex, o Gemini e
// o Cursor: todos aceitam MCP por HTTP (conferido com o Codex 0.162.1 e o Cursor 2026.10.14; o Gemini
// 0.64 declara mcpCapabilities.http). Cada conversa recebe um endereço próprio, com um segredo no
// caminho: é por ele que o Argus sabe qual conversa chamou. Respostas em JSON simples, sem sessão
// nem SSE (o "Streamable HTTP" do MCP permite). Uma etapa pode levar muitos minutos: a requisição
// fica aberta sem prazo, e o cliente que desiste (fechou a conexão) cancela a etapa.

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

type RpcMessage = { jsonrpc: '2.0'; id?: string | number; method?: string; params?: Record<string, unknown> }

const TOOLS = [
  { name: DELEGATE_TOOL, description: TOOL_DESCRIPTIONS[DELEGATE_TOOL], inputSchema: z.toJSONSchema(z.object(delegateShape)) },
  { name: LIST_AGENTS_TOOL, description: TOOL_DESCRIPTIONS[LIST_AGENTS_TOOL], inputSchema: { type: 'object', properties: {} } },
  { name: REPORT_VALIDATION_TOOL, description: TOOL_DESCRIPTIONS[REPORT_VALIDATION_TOOL], inputSchema: z.toJSONSchema(z.object(reportShape)) }
]

const hosts = new Map<string, StepHost>()
let server: Promise<{ server: Server; port: number }> | null = null

function start(): Promise<{ server: Server; port: number }> {
  server ??= new Promise((resolve, reject) => {
    const s = createServer((req, res) => void handle(req, res))
    // Sem prazo: a resposta da delegate só sai quando a etapa termina.
    s.requestTimeout = 0
    s.on('error', (err) => {
      server = null
      reject(err)
    })
    s.listen(0, '127.0.0.1', () => resolve({ server: s, port: (s.address() as AddressInfo).port }))
  })
  return server
}

// Endereço da conversa. dispose: a conversa fechou, o endereço deixa de valer.
export async function registerHost(host: StepHost): Promise<{ url: string; dispose: () => void }> {
  const { port } = await start()
  const token = randomBytes(24).toString('hex')
  hosts.set(token, host)
  return { url: `http://127.0.0.1:${port}/mcp/${token}`, dispose: () => hosts.delete(token) }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = /^\/mcp\/([a-f0-9]+)$/.exec(req.url ?? '')?.[1]
  const host = token ? hosts.get(token) : undefined
  if (!host) return void res.writeHead(404).end()
  // Sem canal de avisos do servidor (GET) nem sessão para encerrar (DELETE).
  if (req.method !== 'POST') return void res.writeHead(405, { Allow: 'POST' }).end()
  let msg: RpcMessage
  try {
    msg = JSON.parse(await body(req)) as RpcMessage
  } catch {
    return void json(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
  }
  // Aviso (sem id): nada a responder.
  if (msg.id === undefined) return void res.writeHead(202).end()
  const abort = new AbortController()
  res.on('close', () => !res.writableEnded && abort.abort())
  try {
    json(res, 200, { jsonrpc: '2.0', id: msg.id, result: await answer(msg, host, abort.signal) })
  } catch (err) {
    json(res, 200, { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: (err as Error).message } })
  }
}

async function answer(msg: RpcMessage, host: StepHost, signal: AbortSignal): Promise<unknown> {
  const p = msg.params ?? {}
  switch (msg.method) {
    case 'initialize': {
      const asked = String(p.protocolVersion ?? '')
      return {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'argus', version: '1' }
      }
    }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: TOOLS }
    case 'tools/call': {
      // O Codex manda o id da chamada (o mesmo do item na conversa) em _meta.callId.
      const meta = p._meta as { callId?: string } | undefined
      return callTool(String(p.name), (p.arguments as Record<string, unknown>) ?? {}, host, signal, meta?.callId)
    }
    default:
      throw new Error(`Método não suportado: ${msg.method}`)
  }
}

function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (c: string) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, value: unknown): void {
  if (res.writableEnded || res.destroyed) return
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value))
}
