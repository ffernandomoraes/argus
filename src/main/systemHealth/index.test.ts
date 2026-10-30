import { describe, expect, it, vi } from 'vitest'
import type { DiskInfo, MemoryInfo, SystemHealthState } from '../../shared/systemHealth'
import { SystemHealth, type HealthReaders } from './index'

// O vigia de memória e disco: o que as janelas recebem, quando, e o que fica até o "Entendi".

const GB = 1024 ** 3
const memory = (level: MemoryInfo['level'], availableBytes = 4 * GB): MemoryInfo => ({ availableBytes, totalBytes: 16 * GB, level })
const disk = (level: DiskInfo['level']): DiskInfo => ({ freeBytes: 50 * GB, totalBytes: 500 * GB, level })

function setup(start: { memory?: MemoryInfo; disk?: DiskInfo } = {}) {
  let mem: MemoryInfo | null = start.memory ?? memory('ok')
  let dsk: DiskInfo | null = start.disk ?? disk('ok')
  let now = 1_000_000
  const readers: HealthReaders = { memory: vi.fn(async () => mem), disk: vi.fn(async () => dsk) }
  const sent: SystemHealthState[] = []
  const health = new SystemHealth(readers, (s) => sent.push(s), () => now)
  return {
    health,
    sent,
    readers,
    setMemory: (m: MemoryInfo | null) => (mem = m),
    setDisk: (d: DiskInfo | null) => (dsk = d),
    later: (ms: number) => (now += ms)
  }
}

describe('SystemHealth', () => {
  it('as janelas só recebem quando muda o nível, não a cada número novo', async () => {
    const { health, sent, setMemory } = setup()
    await health.read()
    setMemory(memory('ok', 5 * GB))
    await health.read()
    expect(sent).toHaveLength(1)
    setMemory(memory('low'))
    const state = await health.read()
    expect(sent).toHaveLength(2)
    expect(state.memory?.level).toBe('low')
  })

  it('a leitura anterior vai junto, para a folga de saída do nível', async () => {
    const { health, readers, setMemory } = setup()
    setMemory(memory('tight'))
    await health.read()
    await health.read()
    expect(readers.memory).toHaveBeenLastCalledWith('tight')
  })

  it('a conversa fechada para liberar memória fica até voltar a trabalhar; o que parou, até o "Entendi"', () => {
    const { health, sent } = setup()
    health.record({ kind: 'chatClosed', cwd: '/p', sessionId: 's1' })
    expect(health.get().freed).toEqual(['s1'])
    health.reopened('s1')
    health.reopened('s1')
    expect(health.get().freed).toEqual([])
    expect(health.get().events.map((e) => e.kind)).toEqual(['chatClosed'])
    health.dismiss()
    expect(health.get().events).toEqual([])
    expect(sent).toHaveLength(3)
  })

  it('disco cheio entra uma vez a cada 10 minutos, não a cada gravação que falha', () => {
    const { health, later } = setup()
    health.record({ kind: 'diskFull' })
    health.record({ kind: 'diskFull' })
    later(11 * 60_000)
    health.record({ kind: 'diskFull' })
    expect(health.get().events).toHaveLength(2)
  })

  it('o que acontece antes de o vigia existir (a janela caindo na abertura) entra quando ele nasce', async () => {
    // O módulo do zero: os testes de cima já criaram vigias.
    vi.resetModules()
    const fresh = await import('./index')
    fresh.recordHealthEvent({ kind: 'windowCrashed' })
    const health = new fresh.SystemHealth({ memory: async () => null, disk: async () => null }, () => undefined)
    expect(health.get().events.map((e) => e.kind)).toEqual(['windowCrashed'])
    // Depois de nascer, vai direto para ele.
    fresh.recordHealthEvent({ kind: 'windowCrashed' })
    expect(health.get().events).toHaveLength(2)
  })
})
