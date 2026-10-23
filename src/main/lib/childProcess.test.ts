import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import { guardStdin, writeStdin } from './childProcess'

// d8f0e23: processo que sai enquanto o Argus escreve nele dava EPIPE sem ouvinte, a exceção solta
// que abre a caixa de erro do processo principal. Aqui com um processo de verdade que sai na hora.

// Processo que fecha sem ler a entrada.
const quitter = (): ChildProcess => spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: ['pipe', 'ignore', 'ignore'] })

// Escreve sem parar enquanto o processo sai, até o pipe quebrar. Sem ouvinte de 'error', o EPIPE
// seria uma exceção solta, e o Vitest reprovaria o arquivo inteiro por erro não tratado.
async function writeUntilBroken(child: ChildProcess): Promise<void> {
  const big = Buffer.alloc(256 * 1024, 'x')
  for (let i = 0; i < 50 && child.stdin && !child.stdin.destroyed; i++) {
    child.stdin.write(big)
    await new Promise((r) => setTimeout(r, 5))
  }
  if (child.exitCode === null) await once(child, 'exit')
}

describe('guardStdin', () => {
  it('escrever num processo que já saiu não vira exceção solta', async () => {
    const child = quitter()
    guardStdin(child)
    await writeUntilBroken(child)
    // O pipe quebrou de verdade (o teste exercitou o caso) e o erro ficou segurado no stdin.
    expect(child.stdin!.errored).toBeTruthy()
  })

  it('pôr de novo não acumula ouvintes', () => {
    const child = quitter()
    guardStdin(child)
    guardStdin(child)
    expect(child.stdin!.listenerCount('error')).toBe(1)
    child.kill()
  })
})

describe('writeStdin', () => {
  it('entrega a entrada e fecha, como o git check-ignore --stdin espera', async () => {
    const child = spawn(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { stdio: ['pipe', 'pipe', 'ignore'] })
    let out = ''
    child.stdout!.on('data', (d) => (out += d))
    expect(writeStdin(child, 'a\nb\n')).toBe(true)
    await once(child, 'close')
    expect(out).toBe('a\nb\n')
  })

  it('stdin já fechado: devolve false em vez de escrever', async () => {
    const child = quitter()
    child.stdin!.end()
    expect(writeStdin(child, 'x')).toBe(false)
    await once(child, 'exit')
  })

  it('processo que saiu antes de ler não derruba quem escreve', async () => {
    const child = quitter()
    await once(child, 'exit')
    expect(() => writeStdin(child, Buffer.alloc(1024 * 1024), { end: false })).not.toThrow()
    await new Promise((r) => setTimeout(r, 50))
  })
})
