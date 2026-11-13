import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { watchDir } from './watchDir'

// Pasta de rede (no Windows, as do WSL: \\wsl.localhost\...) é conferida de tempos em tempos, sem
// o aviso do sistema. Fora do Windows, "//" no começo também conta como de rede e aponta para a
// mesma pasta local, o que deixa testar aqui.

describe('watchDir em pasta de rede', () => {
  // 2026-10-23: conferir na hora, síncrono, se a pasta existia travava o app inteiro enquanto o
  // WSL não respondia.
  it.skipIf(process.platform === 'win32')('pasta que não existe: o vigia sai pelo onError, sem conferir na hora', async () => {
    const onError = vi.fn()
    const w = watchDir('/' + join(process.env.HOME ?? '', 'nao-existe'), () => {}, onError)
    expect(w).not.toBeNull()
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    w?.close()
  })
})
