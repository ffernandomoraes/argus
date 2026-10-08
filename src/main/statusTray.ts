import { basename } from 'node:path'
import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  nativeTheme,
  Tray,
  type MenuItemConstructorOptions,
  type NativeImage
} from 'electron'
import type { ChatState } from '../shared/chat'
import { IS_MAC } from './platform'
import { listSessions } from './sessions'

// Ícone com o estado das conversas abertas neste app: na barra de menus do macOS, ou na área de
// notificação do Windows (perto do relógio). "Concluído" e "erro" ficam marcados até você voltar
// ao app.

type Kind = 'running' | 'needs-you' | 'done' | 'error' | 'idle'
type Entry = { id: string; cwd: string; state: ChatState }
type Finished = { cwd: string; sessionId?: string; kind: 'done' | 'error' }

const LABEL: Record<Kind, string> = {
  running: 'Processando',
  'needs-you': 'Precisa de você',
  done: 'Concluído',
  error: 'Parou com erro',
  idle: 'Parado'
}

// O mais urgente vale para o ícone da barra.
const PRIORITY: Kind[] = ['needs-you', 'running', 'error', 'done', 'idle']

// --- Desenho dos ícones ---
// Desenhados aqui mesmo, sem arquivos de imagem: formas simples em 18×18 pontos, rasterizadas
// a 2x com antisserrilhado. No Mac são "template": o macOS pinta de claro ou escuro conforme a
// barra. No Windows saem em 16 pontos, já na cor que contrasta com a barra de tarefas.
//
// O desenho é o do ícone do app em miniatura: o cartão do projeto e duas conversas ligadas em
// árvore. O estado vai num selo redondo no canto de baixo; parado, sem selo.

const SIZE = 18
const SCALE = 2
const SAMPLES = 4
// Pixels do ícone: 18 pontos no Mac; no Windows, 16 (o tamanho da área de notificação), a 2x.
const PIXELS = IS_MAC ? SIZE * SCALE : 16 * SCALE

// No pnpm dev os cartões ficam só no contorno, para não confundir com o Argus instalado aberto
// ao mesmo tempo.
const DEV = !app.isPackaged

type Shape = (x: number, y: number) => boolean

function segment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}

// Distância com sinal até a borda de um retângulo de cantos arredondados: negativa por dentro.
function roundRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): number {
  const qx = Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - r)
  const qy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

// Cartão cheio; no dev, contorno de 1 ponto.
function card(x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = roundRect(x, y, x0, y0, x1, y1, 1.4)
  return DEV ? d <= 0 && d >= -1 : d <= 0
}

const STROKE = 0.55

const logo: Shape = (x, y) => {
  const tree =
    segment(x, y, 3.5, 6.5, 3.5, 14.5) <= STROKE ||
    segment(x, y, 3.5, 10, 6, 10) <= STROKE ||
    segment(x, y, 3.5, 14.5, 6, 14.5) <= STROKE
  if (tree) return true
  if (card(x, y, 1, 1.5, 15, 6.5)) {
    // A linha do título do projeto, vazada.
    return DEV || segment(x, y, 5, 4, 11, 4) > 0.6
  }
  if (card(x, y, 6, 8.5, 15, 11.5) || card(x, y, 6, 13, 15, 16)) {
    // O ponto de estado de cada conversa, vazado.
    return DEV || (Math.hypot(x - 7.8, y - 10) > 0.75 && Math.hypot(x - 7.8, y - 14.5) > 0.75)
  }
  return false
}

// Selo do estado, por cima da segunda conversa, com uma folga vazia em volta.
const BX = 14.4
const BY = 14.4
const BR = 3.4
const GAP = 1

const withBadge =
  (mark: Shape): Shape =>
  (x, y) => {
    const r = Math.hypot(x - BX, y - BY)
    if (r <= BR) return mark(x - BX, y - BY)
    if (r <= BR + GAP) return false
    return logo(x, y)
  }

// Marcas do selo, em coordenadas relativas ao centro dele.
const bang: Shape = (u, v) => segment(u, v, 0, -1.8, 0, 0.3) <= 0.6 || Math.hypot(u, v - 1.6) <= 0.65
const check: Shape = (u, v) =>
  Math.min(segment(u, v, -1.6, 0.1, -0.5, 1.2), segment(u, v, -0.5, 1.2, 1.7, -1.1)) <= 0.55
const cross: Shape = (u, v) => Math.min(segment(u, v, -1.2, -1.2, 1.2, 1.2), segment(u, v, 1.2, -1.2, -1.2, 1.2)) <= 0.55

// Arco de 3/4 de volta dentro do selo, girado a cada quadro.
const arc =
  (start: number): Shape =>
  (u, v) => {
    if (Math.abs(Math.hypot(u, v) - 2.6) > 0.75) return false
    const rel = (Math.atan2(v, u) - start + 4 * Math.PI) % (2 * Math.PI)
    return rel <= 1.5 * Math.PI
  }

// Barra de tarefas escura no Windows: ícone branco. No Mac, preto (o sistema recolore).
const light = () => !IS_MAC && nativeTheme.shouldUseDarkColorsForSystemIntegratedUI

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

const FRAMES = 12
const FRAME_MS = 90

function drawIcons(): { kinds: Record<Kind, NativeImage>; spinner: NativeImage[] } {
  const spinner = Array.from({ length: FRAMES }, (_, i) => draw(withBadge(arc((i / FRAMES) * 2 * Math.PI))))
  return {
    spinner,
    kinds: {
      running: spinner[0],
      'needs-you': draw(withBadge((u, v) => !bang(u, v))),
      done: draw(withBadge((u, v) => !check(u, v))),
      error: draw(withBadge((u, v) => !cross(u, v))),
      idle: draw(logo)
    }
  }
}

// --- Estado ---

function kindOf(state: ChatState, finished?: Finished): Kind {
  if (state.status === 'needs-you') return 'needs-you'
  if (state.status === 'running') return 'running'
  return finished?.kind ?? 'idle'
}

const MAX_TITLE = 48

function shorten(text: string): string {
  return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE - 1) + '…' : text
}

export class StatusTray {
  private tray: Tray
  private icons = drawIcons()
  private entries: Entry[] = []
  private previous = new Map<string, ChatState['status']>()
  // Conversas que terminaram enquanto você estava fora do app. Continuam aqui mesmo depois que
  // a sessão é encerrada (conversa fechada na tela), até você voltar ao app.
  private finished = new Map<string, Finished>()
  private shown: Kind | null = null
  private timer: NodeJS.Timeout | null = null
  private frame = 0

  constructor(
    private list: () => Entry[],
    private showApp: () => void
  ) {
    this.tray = new Tray(this.icons.kinds.idle)
    const open = (): void => void this.openMenu()
    this.tray.on('click', open)
    this.tray.on('right-click', open)
    // Windows: a barra de tarefas trocou de tema claro para escuro (ou o contrário).
    if (!IS_MAC) nativeTheme.on('updated', this.redraw)
    this.refresh()
  }

  private redraw = (): void => {
    this.icons = drawIcons()
    this.shown = null
    this.paint()
  }

  // Chamado a cada mudança de estado de uma conversa.
  refresh(): void {
    this.entries = this.list()
    const seen = new Set<string>()
    for (const { id, cwd, state } of this.entries) {
      seen.add(id)
      const before = this.previous.get(id)
      this.previous.set(id, state.status)
      if (state.status !== 'idle') this.finished.delete(id)
      else if (before && before !== 'idle' && !BrowserWindow.getFocusedWindow()) {
        // Terminou com você em outro app: fica marcado até você voltar.
        this.finished.set(id, { cwd, sessionId: state.sessionId, kind: state.error ? 'error' : 'done' })
      }
    }
    for (const id of this.previous.keys()) if (!seen.has(id)) this.previous.delete(id)
    this.paint()
  }

  // Você voltou ao app: os avisos de concluído já foram vistos.
  seen(): void {
    if (!this.finished.size) return
    this.finished.clear()
    this.paint()
  }

  destroy(): void {
    this.stopSpinner()
    nativeTheme.off('updated', this.redraw)
    this.tray.destroy()
  }

  private kinds(): Kind[] {
    const live = new Set(this.entries.map((e) => e.id))
    return [
      ...this.entries.map((e) => kindOf(e.state, this.finished.get(e.id))),
      ...[...this.finished].filter(([id]) => !live.has(id)).map(([, f]) => f.kind)
    ]
  }

  private paint(): void {
    const kinds = this.kinds()
    const top = PRIORITY.find((k) => kinds.includes(k)) ?? 'idle'
    const counts = PRIORITY.filter((k) => k !== 'idle')
      .map((k) => [k, kinds.filter((x) => x === k).length] as const)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`)
    this.tray.setToolTip(`${app.name}: ${counts.length ? counts.join(', ') : 'nada rodando'}`)
    if (top === this.shown) return
    this.shown = top
    if (top === 'running') this.startSpinner()
    else {
      this.stopSpinner()
      this.tray.setImage(this.icons.kinds[top])
    }
  }

  private startSpinner(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % FRAMES
      this.tray.setImage(this.icons.spinner[this.frame])
    }, FRAME_MS)
  }

  private stopSpinner(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  // Menu montado na hora do clique: os títulos vêm dos arquivos das sessões.
  private async openMenu(): Promise<void> {
    const live = new Set(this.entries.map((e) => e.id))
    const rows = [
      ...this.entries.map((e) => ({
        cwd: e.cwd,
        sessionId: e.state.sessionId,
        kind: kindOf(e.state, this.finished.get(e.id))
      })),
      ...[...this.finished].filter(([id]) => !live.has(id)).map(([, f]) => ({ ...f }))
    ]

    const byProject = new Map<string, typeof rows>()
    for (const r of rows) byProject.set(r.cwd, [...(byProject.get(r.cwd) ?? []), r])

    const titles = new Map<string, string>()
    await Promise.all(
      [...byProject.keys()].map(async (cwd) => {
        try {
          for (const s of await listSessions(cwd)) titles.set(s.id, s.title)
        } catch {
          // sem título: usa o texto padrão
        }
      })
    )

    const items: MenuItemConstructorOptions[] = []
    for (const [cwd, list] of byProject) {
      items.push({ type: 'separator' })
      items.push({ label: basename(cwd) || cwd, enabled: false })
      for (const r of list.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))) {
        const title = (r.sessionId && titles.get(r.sessionId)) || 'Conversa nova'
        items.push({
          label: `${shorten(title)}  -  ${LABEL[r.kind]}`,
          // No Windows o menu tem fundo próprio, que não combina com a cor do ícone da barra.
          icon: IS_MAC ? this.icons.kinds[r.kind] : undefined,
          click: this.showApp
        })
      }
    }
    if (!items.length) items.push({ type: 'separator' }, { label: 'Nenhuma conversa aberta', enabled: false })
    // Título no topo, para saber de qual Argus é o menu: o instalado ou o do pnpm dev. Cabeçalho
    // de menu só existe no macOS; no Windows é uma linha apagada.
    const title = DEV ? `${app.name} - Desenvolvimento` : `${app.name} ${app.getVersion()}`
    items.unshift(IS_MAC ? { type: 'header', label: title } : { label: title, enabled: false })
    items.push(
      { type: 'separator' },
      { label: `Abrir ${app.name}`, click: this.showApp },
      { label: `Sair do ${app.name}`, role: 'quit' }
    )
    this.tray.popUpContextMenu(Menu.buildFromTemplate(items))
  }
}
