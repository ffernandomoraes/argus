import type { CSSProperties } from 'react'

const SIZE = 10

// Lado do menu em que a seta fica, apontando para o botão que o abriu. Um quadrado girado 45°
// com borda só nos dois lados de fora e recortado na metade de fora: o centro fica sobre a borda
// do menu, então a base da seta cobre a borda e os dois parecem uma peça só.
const SIDES = {
  top: {
    edge: 'top',
    border: 'border-l border-t',
    clip: 'polygon(0 0, 100% 0, 0 100%)'
  },
  bottom: {
    edge: 'bottom',
    border: 'border-b border-r',
    clip: 'polygon(100% 0, 100% 100%, 0 100%)'
  },
  left: {
    edge: 'left',
    border: 'border-b border-l',
    clip: 'polygon(0 0, 0 100%, 100% 100%)'
  }
} as const

// Vai dentro da caixa do menu (que não pode cortar o que vaza: rolagem fica num filho).
// `align`: de que ponta da borda conta o `at`, a distância até o meio da seta; o padrão cai perto
// do fim do botão, já que o menu se alinha pela mesma ponta que ele.
export function MenuArrow({
  side,
  align = 'start',
  at = 14
}: {
  side: keyof typeof SIDES
  align?: 'start' | 'end'
  at?: number
}) {
  const s = SIDES[side]
  const along = side === 'left' ? (align === 'start' ? 'top' : 'bottom') : align === 'start' ? 'left' : 'right'
  const style: CSSProperties = {
    width: SIZE,
    height: SIZE,
    [s.edge]: -SIZE / 2,
    [along]: at - SIZE / 2,
    clipPath: s.clip
  }
  return (
    <span aria-hidden style={style} className={`pointer-events-none absolute rotate-45 border-line bg-surface ${s.border}`} />
  )
}
