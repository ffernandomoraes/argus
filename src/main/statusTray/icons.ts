import { nativeImage, nativeTheme, type NativeImage } from 'electron'
import { IS_MAC } from '../platform'
import type { Kind } from './kinds'
import { arc, bang, check, cross, hollow, logo, withBadge, type Shape } from './shapes'

// Ícones desenhados aqui mesmo, sem arquivos de imagem: as formas de shapes.ts rasterizadas a 2x
// com antisserrilhado. No Mac são "template": o macOS pinta de claro ou escuro conforme a barra.
// No Windows saem em 16 pontos, já na cor que contrasta com a barra de tarefas.

const SIZE = 18
const SCALE = 2
const SAMPLES = 4
// Pixels do ícone: 18 pontos no Mac; no Windows, 16 (o tamanho da área de notificação), a 2x.
const PIXELS = IS_MAC ? SIZE * SCALE : 16 * SCALE

// Quadros da animação de "processando".
export const FRAMES = 12

export type TrayIcons = { kinds: Record<Kind, NativeImage>; spinner: NativeImage[] }

// Barra de tarefas escura no Windows: ícone branco. No Mac, preto (o sistema recolore).
const light = (): boolean => !IS_MAC && nativeTheme.shouldUseDarkColorsForSystemIntegratedUI

function draw(shape: Shape): NativeImage {
  const px = PIXELS
  // Cinza (branco ou preto): só o alfa muda o desenho, então a ordem BGRA/RGBA não importa.
  const tone = light() ? 255 : 0
  const buffer = Buffer.alloc(px * px * 4)
  for (let py = 0; py < px; py++) {
    for (let qx = 0; qx < px; qx++) {
      let hits = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = ((qx + (sx + 0.5) / SAMPLES) * SIZE) / px
          const y = ((py + (sy + 0.5) / SAMPLES) * SIZE) / px
          if (shape(x, y)) hits++
        }
      }
      const i = (py * px + qx) * 4
      buffer[i] = buffer[i + 1] = buffer[i + 2] = tone
      buffer[i + 3] = Math.round((hits / (SAMPLES * SAMPLES)) * 255)
    }
  }
  const img = nativeImage.createFromBitmap(buffer, { width: px, height: px, scaleFactor: SCALE })
  if (IS_MAC) img.setTemplateImage(true)
  return img
}

// dev: no pnpm dev os cartões ficam só no contorno, para não confundir com o Argus instalado
// aberto ao mesmo tempo.
export function drawIcons(dev: boolean): TrayIcons {
  const base = logo(dev)
  const spinner = Array.from({ length: FRAMES }, (_, i) => draw(withBadge(base, arc((i / FRAMES) * 2 * Math.PI))))
  return {
    spinner,
    kinds: {
      running: spinner[0],
      'needs-you': draw(withBadge(base, hollow(bang))),
      done: draw(withBadge(base, hollow(check))),
      error: draw(withBadge(base, hollow(cross))),
      idle: draw(base)
    }
  }
}
