import { basename } from 'node:path'
import { app, BrowserWindow, Menu, nativeImage, Tray, type MenuItemConstructorOptions, type NativeImage } from 'electron'
import type { ChatState } from '../shared/chat'
import { listSessions } from './sessions'

// Ícone na barra de menus do macOS com o estado das conversas abertas neste app.
// "Concluído" e "erro" ficam marcados até você voltar ao app.

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
// a 2x com antisserrilhado. São "template": o macOS pinta de claro ou escuro conforme a barra.

const SIZE = 18
const SCALE = 2
const SAMPLES = 4

type Shape = (x: number, y: number) => boolean

function segment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}

const dist = (x: number, y: number): number => Math.hypot(x - 9, y - 9)
const ring: Shape = (x, y) => Math.abs(dist(x, y) - 6.5) <= 0.85
const disc: Shape = (x, y) => dist(x, y) <= 7.5

const check: Shape = (x, y) =>
  Math.min(segment(x, y, 5.6, 9.2, 8, 11.6), segment(x, y, 8, 11.6, 12.4, 6.8)) <= 1
const cross: Shape = (x, y) =>
  Math.min(segment(x, y, 6.5, 6.5, 11.5, 11.5), segment(x, y, 11.5, 6.5, 6.5, 11.5)) <= 1
const bang: Shape = (x, y) => segment(x, y, 9, 4.8, 9, 10) <= 1.1 || Math.hypot(x - 9, y - 13) <= 1.2

// Arco de 3/4 de volta, girado a cada quadro.
const arc =
  (start: number): Shape =>
  (x, y) => {
    if (!ring(x, y)) return false
    const rel = (Math.atan2(y - 9, x - 9) - start + 4 * Math.PI) % (2 * Math.PI)
    return rel <= 1.5 * Math.PI
  }

function draw(shape: Shape): NativeImage {
  const px = SIZE * SCALE
  // Pixels pretos: só o alfa importa (a ordem BGRA/RGBA não muda nada).
  const buffer = Buffer.alloc(px * px * 4)
  for (let py = 0; py < px; py++) {
    for (let qx = 0; qx < px; qx++) {
      let hits = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (qx + (sx + 0.5) / SAMPLES) / SCALE
          const y = (py + (sy + 0.5) / SAMPLES) / SCALE
          if (shape(x, y)) hits++
        }
      }
      buffer[(py * px + qx) * 4 + 3] = Math.round((hits / (SAMPLES * SAMPLES)) * 255)
    }
  }
  const img = nativeImage.createFromBitmap(buffer, { width: px, height: px, scaleFactor: SCALE })
  img.setTemplateImage(true)
  return img
}

const FRAMES = 12
const FRAME_MS = 90

function drawIcons(): { kinds: Record<Kind, NativeImage>; spinner: NativeImage[] } {
  const spinner = Array.from({ length: FRAMES }, (_, i) => draw(arc((i / FRAMES) * 2 * Math.PI)))
  return {
    spinner,
    kinds: {
      running: spinner[0],
      'needs-you': draw((x, y) => disc(x, y) && !bang(x, y)),
      done: draw((x, y) => disc(x, y) && !check(x, y)),
      error: draw((x, y) => disc(x, y) && !cross(x, y)),
      idle: draw(ring)
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
    this.refresh()
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
      if (items.length) items.push({ type: 'separator' })
      items.push({ label: basename(cwd) || cwd, enabled: false })
      for (const r of list.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))) {
        const title = (r.sessionId && titles.get(r.sessionId)) || 'Conversa nova'
        items.push({
          label: `${shorten(title)}  -  ${LABEL[r.kind]}`,
          icon: this.icons.kinds[r.kind],
          click: this.showApp
        })
      }
    }
    if (!items.length) items.push({ label: 'Nenhuma conversa aberta', enabled: false })
    items.push(
      { type: 'separator' },
      { label: `Abrir ${app.name}`, click: this.showApp },
      { label: `Sair do ${app.name}`, role: 'quit' }
    )
    this.tray.popUpContextMenu(Menu.buildFromTemplate(items))
  }
}
