import { spawn, type ChildProcess } from 'node:child_process'
import { homedir } from 'node:os'
import { guardStdin } from '../lib/childProcess'
import type { Launch } from './env'

// JSON-RPC por linha na entrada e saída padrão: o `codex app-server` fala assim (o ACP também, mas
// esse vai pela biblioteca oficial). Pedidos do servidor para o app (aprovações, por exemplo)
// chegam em onRequest; avisos, em onNotification.

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly data?: unknown
  ) {
    super(message)
  }
}

export class JsonRpcProcess {
  private child: ChildProcess
  private nextId = 1
  private pending = new Map<number, Pending>()
  private buffer = ''
  private stderr = ''
  private exited = false
  onNotification: (method: string, params: unknown) => void = () => {}
  onRequest: (method: string, params: unknown) => Promise<unknown> = async () => {
    throw new RpcError('não suportado', -32601)
  }
  onExit: (code: number | null) => void = () => {}

  constructor(launch: Launch, cwd = homedir()) {
    this.child = spawn(launch.file, launch.args, { env: launch.env, cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    guardStdin(this.child)
    this.child.stdout!.setEncoding('utf8')
    this.child.stdout!.on('data', (d: string) => this.read(d))
    this.child.stderr!.on('data', (d: Buffer) => {
      this.stderr = (this.stderr + d.toString('utf8')).slice(-4000)
    })
    const end = (code: number | null) => {
      if (this.exited) return
      this.exited = true
      const reason = this.lastError() || `o processo saiu (${code})`
      for (const p of this.pending.values()) {
        clearTimeout(p.timer)
        p.reject(new RpcError(reason))
      }
      this.pending.clear()
      this.onExit(code)
    }
    this.child.on('exit', end)
    this.child.on('error', (err) => {
      this.stderr += err.message
      end(null)
    })
  }

  // Últimas linhas do stderr, para explicar uma saída inesperada.
  lastError(): string {
    return this.stderr.trim().split(/\r?\n/).slice(-3).join('\n')
  }

  get alive(): boolean {
    return !this.exited
  }

  request<T = unknown>(method: string, params?: unknown, timeoutMs = 60_000): Promise<T> {
    if (this.exited) return Promise.reject(new RpcError(this.lastError() || 'processo encerrado'))
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new RpcError(`sem resposta para ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      this.write({ jsonrpc: '2.0', id, method, ...(params !== undefined && { params }) })
    })
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: '2.0', method, ...(params !== undefined && { params }) })
  }

  close(): void {
    if (this.exited) return
    this.child.stdin?.end()
    this.child.kill()
  }

  private write(msg: unknown): void {
    const stdin = this.child.stdin
    if (!stdin || stdin.destroyed || stdin.writableEnded) return
    stdin.write(JSON.stringify(msg) + '\n')
  }

  private read(chunk: string): void {
    this.buffer += chunk
    let i: number
    while ((i = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, i).trim()
      this.buffer = this.buffer.slice(i + 1)
      if (!line) continue
      let msg: { id?: number | string; method?: string; params?: unknown; result?: unknown; error?: { message: string; code?: number; data?: unknown } }
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.method && msg.id !== undefined) void this.answer(msg.id, msg.method, msg.params)
      else if (msg.method) this.onNotification(msg.method, msg.params)
      else if (typeof msg.id === 'number') {
        const p = this.pending.get(msg.id)
        if (!p) continue
        this.pending.delete(msg.id)
        clearTimeout(p.timer)
        if (msg.error) p.reject(new RpcError(msg.error.message, msg.error.code, msg.error.data))
        else p.resolve(msg.result)
      }
    }
  }

  private async answer(id: number | string, method: string, params: unknown): Promise<void> {
    try {
      this.write({ jsonrpc: '2.0', id, result: await this.onRequest(method, params) })
    } catch (err) {
      const e = err as RpcError
      this.write({ jsonrpc: '2.0', id, error: { code: e.code ?? -32603, message: e.message } })
    }
  }
}
