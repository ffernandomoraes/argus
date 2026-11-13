export type Backoff = {
  // Espera antes da próxima tentativa; cada chamada aumenta a seguinte até o teto.
  next(): number
  // Voltou a funcionar: a próxima espera é a inicial de novo.
  reset(): void
}

// Espera crescente para reiniciar um processo que caiu (ex.: 30 s, 1 min, 2 min... até 10 min),
// sem martelar um `claude` que não abre.
export function createBackoff({ initialMs, maxMs, factor = 2 }: { initialMs: number; maxMs: number; factor?: number }): Backoff {
  let current = initialMs
  return {
    next: () => {
      const wait = current
      current = Math.min(maxMs, current * factor)
      return wait
    },
    reset: () => {
      current = initialMs
    }
  }
}
