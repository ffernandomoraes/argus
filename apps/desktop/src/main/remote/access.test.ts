import { powerSaveBlocker } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { RemoteAccess } from './access'

// Com o acesso remoto ligado, o computador de casa não pode dormir: dormindo, sai da internet e
// ninguém de longe o acorda (2026-11-11). A opção vem ligada e vale só enquanto hospeda.

// Ligar o acesso conecta na ponte: aqui, num endereço local que recusa na hora (nada sai para a internet).
process.env.ARGUS_RELAY_URL = 'ws://127.0.0.1:9'

describe('manter acordado enquanto hospeda', () => {
  it('segura o sono ao ligar o acesso e solta ao desligar ou ao desmarcar', () => {
    let started = 0
    const live = new Set<number>()
    Object.assign(powerSaveBlocker, {
      start: vi.fn(() => {
        live.add(++started)
        return started
      }),
      stop: vi.fn((id: number) => live.delete(id)),
      isStarted: (id: number) => live.has(id)
    })
    const access = new RemoteAccess({
      hostName: () => 'casa',
      hostInfo: () => ({ name: 'casa', platform: 'darwin', homeDir: '/', windowsBuild: null, version: '1' }),
      openWindow: async () => {},
      focus: () => {},
      onChange: () => {}
    })
    expect(access.state().keepAwake).toBe(true)
    access.setHosting(true)
    expect(live.size).toBe(1)
    access.setKeepAwake(false)
    expect(live.size).toBe(0)
    access.setKeepAwake(true)
    expect(live.size).toBe(1)
    access.setHosting(false)
    expect(live.size).toBe(0)
    access.shutdown()
  })
})
