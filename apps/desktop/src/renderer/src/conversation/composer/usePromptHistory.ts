import { useRef } from 'react'

// Pedidos enviados por conversa, como foram digitados. Vale enquanto o app está aberto; depois
// disso a lista vem do histórico gravado (fromHistory).
const sentByKey = new Map<string, string[]>()

// Seta para cima e para baixo no campo, igual ao terminal: com o campo vazio, ↑ traz o último
// pedido e cada ↑ seguinte o anterior; ↓ volta para os mais novos e, depois do mais novo, limpa o
// campo. Digitar qualquer coisa sai da navegação.
export function usePromptHistory(key: string, fromHistory: string[]) {
  // Posição na lista (0 = o mais recente) e o texto que ela pôs no campo.
  const at = useRef<{ index: number; text: string } | null>(null)

  const list = (): string[] => {
    const sent = sentByKey.get(key) ?? []
    const known = new Set(fromHistory)
    // Do mais novo para o mais velho; o que foi enviado agora pode ainda não estar no histórico.
    return [...sent.filter((t) => !known.has(t)).reverse(), ...[...fromHistory].reverse()]
  }

  return {
    remember: (text: string) => {
      const sent = sentByKey.get(key) ?? []
      sentByKey.set(key, [...sent.filter((t) => t !== text), text])
      at.current = null
    },
    // Texto que a seta põe no campo, ou null se a seta deve fazer o de sempre (mover o cursor).
    step: (direction: 1 | -1, draft: string): string | null => {
      const navigating = at.current && at.current.text === draft ? at.current : null
      if (!navigating && (direction === 1 || draft)) return null
      const items = list()
      const index = (navigating?.index ?? -1) + (direction === -1 ? 1 : -1)
      if (index >= items.length) return null
      if (index < 0) {
        at.current = null
        return ''
      }
      at.current = { index, text: items[index] }
      return items[index]
    }
  }
}
