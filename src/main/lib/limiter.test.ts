import { describe, expect, it } from 'vitest'
import { limiter } from './limiter'

// O git das pastas do WSL passa por aqui: sem limite, as consultas de fundo se acumulavam às
// dezenas de wsl.exe com o WSL lento (2026-10-23).

const flush = () => new Promise((r) => setTimeout(r, 0))

function gate() {
  let open!: () => void
  const promise = new Promise<void>((r) => (open = r))
  return { promise, open }
}

describe('limiter', () => {
  it('no máximo N ao mesmo tempo; os outros começam na ordem em que chegaram', async () => {
    const run = limiter(2)
    const gates = [gate(), gate(), gate(), gate(), gate()]
    const started: number[] = []
    let running = 0
    let peak = 0
    const tasks = gates.map((g, i) =>
      run(async () => {
        started.push(i)
        peak = Math.max(peak, ++running)
        await g.promise
        running--
        return i
      })
    )
    await flush()
    expect(started).toEqual([0, 1])
    gates[1].open()
    await flush()
    expect(started).toEqual([0, 1, 2])
    // Chegou outra enquanto a fila andava: vai para o fim, não passa na frente.
    const late = run(async () => (started.push(9), 9))
    gates.forEach((g) => g.open())
    expect(await Promise.all([...tasks, late])).toEqual([0, 1, 2, 3, 4, 9])
    expect(started).toEqual([0, 1, 2, 3, 4, 9])
    expect(peak).toBe(2)
  })

  it('tarefa que falha devolve a vaga', async () => {
    const run = limiter(1)
    await expect(run(async () => Promise.reject(new Error('git saiu com erro')))).rejects.toThrow('git saiu com erro')
    expect(await run(async () => 'seguiu')).toBe('seguiu')
  })
})
