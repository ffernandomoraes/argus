import { format } from 'node:util'

// Os avisos e erros do processo principal (console.warn e console.error), guardados também em
// memória: vão no relatório de problema. Sem isso, o que deu errado na máquina da pessoa só
// aparece num terminal que ela não tem aberto.
const MAX = 300
const LINE_MAX = 1000
const lines: string[] = []

function keep(level: string, args: unknown[]): void {
  const text = format(...args)
  lines.push(`${new Date().toISOString()} ${level} ${text.length > LINE_MAX ? `${text.slice(0, LINE_MAX)}…` : text}`)
  if (lines.length > MAX) lines.shift()
}

let installed = false

// Na partida, antes dos serviços.
export function captureAppLog(): void {
  if (installed) return
  installed = true
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      keep(level, args)
      original(...args)
    }
  }
}

export const appLogLines = (): string[] => [...lines]
