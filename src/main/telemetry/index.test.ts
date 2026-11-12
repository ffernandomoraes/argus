import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validate } from '../../../telemetry/src/validate'
import { saveAppSettings } from '../appSettings'
import type { TelemetrySources } from '.'

const sources: TelemetrySources = {
  busy: () => false,
  claudeCode: () => '2.1.300',
  wsl: () => false,
  snapshot: () => ({
    workspaces: 2,
    folders: 5,
    worktrees: 1,
    groups: 1,
    chatCards: 0,
    terminals: 1,
    notes: 0,
    claudeAccounts: 1,
    claudePlans: { max: 1 },
    providers: ['codex'],
    remoteAccess: false
  })
}

const tokens = (input: number, output: number, costUsd = 0) => ({ input, output, cacheRead: 0, cacheWrite: 0, costUsd })

describe('dados de uso', () => {
  let bodies: unknown[]

  beforeEach(() => {
    vi.resetModules()
    rmSync(join(app.getPath('userData'), 'telemetry.json'), { force: true })
    saveAppSettings({ usageStats: true })
    process.env.ARGUS_TELEMETRY_URL = 'http://telemetry.test/v1/report'
    bodies = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body))
        return new Response(null, { status: 204 })
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.ARGUS_TELEMETRY_URL
  })

  // O resumo que o app monta tem que passar na conferência do Worker (telemetry/src/validate.ts):
  // se um lado mudar o formato sem o outro, os dados param de chegar sem ninguém ver.
  it('manda um resumo que o Worker aceita, sem contar tokens em dobro', async () => {
    const { telemetry } = await import('.')
    telemetry.start(sources)
    telemetry.chatCreated('claude')
    telemetry.messageSent('claude')
    telemetry.messageSent('claude')
    telemetry.toolUsed('Bash')
    telemetry.toolUsed('mcp__empresa__deploy')
    // Dois fins de pedido da mesma conversa: o segundo traz o total acumulado.
    telemetry.claudeResult('s1', { 'claude-opus-5-5': tokens(100, 50, 1) }, false, null)
    telemetry.claudeResult('s1', { 'claude-opus-5-5': tokens(160, 70, 1.5) }, false, null)
    await (telemetry as unknown as { send: () => Promise<void> }).send()
    telemetry.stop()

    expect(bodies).toHaveLength(1)
    const report = validate(bodies[0])
    expect(report).not.toBeNull()
    expect(report!.models['claude:claude-opus-5-5']).toMatchObject({ turns: 2, input: 160, output: 70, costUsd: 1.5 })
    expect(report!.counts.chatsCreated).toEqual({ claude: 1 })
    expect(report!.counts.messagesSent).toEqual({ claude: 2 })
    expect(report!.tools).toEqual({ Bash: 1, mcp: 1 })
    expect(report!.snapshot?.folders).toBe(5)
  })

  it('conversa retomada sem total guardado conta só o pedido de agora', async () => {
    const { telemetry } = await import('.')
    telemetry.start(sources)
    telemetry.claudeResult('antiga', { 'claude-opus-5-5': tokens(90_000, 40_000, 30) }, true, tokens(200, 80))
    await (telemetry as unknown as { send: () => Promise<void> }).send()
    telemetry.stop()
    expect(validate(bodies[0])!.models['claude:claude-opus-5-5']).toMatchObject({ input: 200, output: 80, costUsd: 0 })
  })

  it('desligado nas Configurações, não junta nem manda nada', async () => {
    saveAppSettings({ usageStats: false })
    const { telemetry } = await import('.')
    telemetry.start(sources)
    telemetry.chatCreated('claude')
    await (telemetry as unknown as { send: () => Promise<void> }).send()
    expect(bodies).toHaveLength(0)
  })
})
