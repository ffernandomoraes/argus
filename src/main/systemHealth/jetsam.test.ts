import { describe, expect, it } from 'vitest'
import { jetsamCause, killReasonIn } from './jetsam'

// O relatório que o macOS grava quando mata processos por memória (JetsamEvent-*.ips): a primeira
// linha é o cabeçalho; o resto, a lista dos processos da hora, com o motivo no que morreu. O formato
// segue um relatório de verdade (macOS 27, 2026-10-30), reduzido.

const report = (processes: unknown[]) =>
  `${JSON.stringify({ bug_type: '298', timestamp: '2026-10-30 11:37:16.00 -0300' })}\n${JSON.stringify({
    largestProcess: 'Google Chrome Helper',
    memoryStatus: { pageSize: 16384 },
    processes
  })}`

describe('killReasonIn', () => {
  it('acha o motivo gravado para o pid; quem só estava na lista não conta', () => {
    const text = report([
      { pid: 100, name: 'claude', rpages: 5000 },
      { pid: 200, name: 'claude', reason: 'vm-compressor-space-shortage', killDelta: 120 }
    ])
    expect(killReasonIn(text, 200)).toBe('vm-compressor-space-shortage')
    expect(killReasonIn(text, 100)).toBeNull()
    expect(killReasonIn(text, 300)).toBeNull()
  })

  it('relatório pela metade ou estranho não quebra', () => {
    expect(killReasonIn('{"bug_type":"298"}\n{"processes": [', 1)).toBeNull()
    expect(killReasonIn('', 1)).toBeNull()
    expect(killReasonIn(report([{ pid: '1', reason: 'per-process-limit' }]), 1)).toBeNull()
  })
})

describe('jetsamCause', () => {
  it('separa o limite do próprio processo da falta de memória no computador', () => {
    expect(jetsamCause('per-process-limit')).toBe('processLimit')
    expect(jetsamCause('highwater')).toBe('processLimit')
    expect(jetsamCause('vm-pageshortage')).toBe('memory')
    expect(jetsamCause('vm-compressor-space-shortage')).toBe('memory')
    // Motivo que não é de memória: sem confirmação.
    expect(jetsamCause('idle-exit')).toBeNull()
    expect(jetsamCause('vnode-limit')).toBeNull()
  })
})
