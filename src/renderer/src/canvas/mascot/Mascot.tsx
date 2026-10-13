import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { ActiveChat } from '../../../../shared/chat'
import { tr } from '../../i18n'
import { IS_WIN } from '../../platform'
import { getPreferences, setPreferences, usePreference } from '../../settings/preferences'
import { useActiveChatsInCanvas } from '../canvasScope'
import { useFinishedChats } from '../sessionsStore'
import type { CanvasNode } from '../types'
import { BODY_X, LASH_TIP, LEFT_EDGE, MascotFigure, VIEW, WHIP_MS, type Pose } from './MascotFigure'

// Mascote no canto esquerdo da janela, no meio da altura. Brincadeira, liga em
// Configurações > Geral. O que ele faz:
// - pedido enviado: anda até a pasta da conversa, dá uma chicotada e volta;
// - conversa terminou: joia;
// - você escrevendo um pedido: mão na orelha, escutando;
// - conversa esperando você ou resposta não vista: acena;
// - conversa trabalhando: dança;
// - nada acontecendo: parado, piscando.

// Tamanho na tela: px por unidade do desenho (o boneco fica com uns 80 px de altura).
const SCALE = 0.55
const WIDTH = VIEW.w * SCALE
const HEIGHT = VIEW.h * SCALE
// Ponto do desenho em px, a partir do canto do quadro do mascote.
const toPx = (x: number) => (x - VIEW.x) * SCALE
const toPy = (y: number) => (y - VIEW.y) * SCALE
const MARGIN = 8
// Velocidade da caminhada (px/s).
const SPEED = 320
const THUMBS_MS = 2200
// Depois da última tecla, ainda conta como escrevendo.
const TYPING_MS = 1500

type Point = { x: number; y: number }
type Action = 'go' | 'whip' | 'back' | 'thumbs' | null

export function Mascot({ nodesRef, hidden }: { nodesRef: RefObject<CanvasNode[]>; hidden: boolean }) {
  const on = usePreference('mascot')
  if (!on || hidden) return null
  return <MascotView nodesRef={nodesRef} />
}

// Parte do quadro onde está o boneco (o resto é espaço do chicote): é por ela que se arrasta.
const BODY_BOX = { x: toPx(24), y: toPy(4), w: toPx(96) - toPx(24), h: toPy(150) - toPy(4) }
// Arrastar menos que isso é clique, não muda o lugar.
const DRAG_MIN = 3

// Quadro dentro da janela, com o boneco inteiro à vista.
function clampToWindow(p: Point): Point {
  return {
    x: Math.round(Math.max(MARGIN - BODY_BOX.x, Math.min(window.innerWidth - MARGIN - BODY_BOX.x - BODY_BOX.w, p.x))),
    y: Math.round(Math.max(MARGIN - BODY_BOX.y, Math.min(window.innerHeight - MARGIN - BODY_BOX.y - BODY_BOX.h, p.y)))
  }
}

// Em casa: onde a pessoa deixou (salvo em fração da janela) ou, sem isso, a MARGIN da borda
// esquerda, no meio da altura.
function home(): Point {
  const spot = getPreferences().mascotSpot
  if (spot) return clampToWindow({ x: spot.x * window.innerWidth, y: spot.y * window.innerHeight })
  return { x: MARGIN - toPx(LEFT_EDGE), y: Math.round(window.innerHeight / 2 - HEIGHT / 2) }
}

function MascotView({ nodesRef }: { nodesRef: RefObject<CanvasNode[]> }) {
  // Só o que está no canvas desta janela (ver canvasScope).
  const chats = useActiveChatsInCanvas()
  const unreadCount = useFinishedChats().length
  const typing = useTyping()

  const [action, setAction] = useState<Action>(null)
  const [pos, setPos] = useState<Point>(home)
  const [moveMs, setMoveMs] = useState(0)
  const [faceLeft, setFaceLeft] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Fila de ações: um envio com outra ação em andamento é ignorado; a joia espera a volta.
  const busy = useRef(false)
  const thumbsPending = useRef(false)
  const timers = useRef<number[]>([])
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Volta ao meio da altura quando a janela muda de tamanho (parado em casa).
  useEffect(() => {
    const onResize = () => {
      if (busy.current) return
      setMoveMs(0)
      setPos(home())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const playThumbs = () => {
    busy.current = true
    thumbsPending.current = false
    setAction('thumbs')
    later(THUMBS_MS, () => {
      busy.current = false
      setAction(null)
    })
  }

  const walk = (from: Point, to: Point) => {
    const ms = Math.min(1800, Math.max(250, (Math.hypot(to.x - from.x, to.y - from.y) / SPEED) * 1000))
    setFaceLeft(to.x < from.x)
    setMoveMs(ms)
    setPos(to)
    return ms
  }

  const playWhip = (cwd: string) => {
    if (busy.current) return
    busy.current = true
    const start = home()
    const target = targetFor(cwd, nodesRef.current ?? [])
    // Pasta fora da tela (ou conversa sem pasta no canvas): chicotada ali mesmo.
    const goMs = target ? walk(start, target) : 0
    setAction(target ? 'go' : 'whip')
    later(goMs, () => {
      setFaceLeft(false)
      setAction('whip')
      later(WHIP_MS, () => {
        const backMs = target ? walk(target, start) : 0
        setAction(target ? 'back' : null)
        later(backMs, () => {
          setFaceLeft(false)
          setAction(null)
          busy.current = false
          if (thumbsPending.current) playThumbs()
        })
      })
    })
  }

  // Arrastar: o boneco segue o ponteiro e, ao soltar, o lugar vira a casa dele. Andando ou
  // chicoteando, não dá para pegar. Enquanto está na mão, envio de pedido não chicoteia.
  const grab = useRef<{ dx: number; dy: number; x0: number; y0: number } | null>(null)
  const pointAt = (e: ReactPointerEvent) => clampToWindow({ x: e.clientX - grab.current!.dx, y: e.clientY - grab.current!.dy })
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busy.current || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    busy.current = true
    grab.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, x0: e.clientX, y0: e.clientY }
    setMoveMs(0)
    setDragging(true)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (grab.current) setPos(pointAt(e))
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    const g = grab.current
    if (!g) return
    if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) >= DRAG_MIN) {
      const p = pointAt(e)
      setPreferences({ mascotSpot: { x: p.x / window.innerWidth, y: p.y / window.innerHeight } })
    }
    grab.current = null
    busy.current = false
    setDragging(false)
    if (thumbsPending.current) playThumbs()
  }
  // Dois cliques: volta andando ao canto de sempre.
  const onDoubleClick = () => {
    if (busy.current) return
    setPreferences({ mascotSpot: null })
    busy.current = true
    const ms = walk(pos, home())
    setAction('back')
    later(ms, () => {
      setFaceLeft(false)
      setAction(null)
      busy.current = false
      if (thumbsPending.current) playThumbs()
    })
  }

  // Envio e fim de pedido saem da lista de conversas ativas: pedido novo = turnStartedAt novo;
  // fim = a conversa sai da lista ou fica só com tarefas em segundo plano.
  const seen = useRef<Map<string, number | undefined> | null>(null)
  useEffect(() => {
    const before = seen.current
    seen.current = new Map(chats.map((c) => [c.key, c.turnStartedAt]))
    if (!before) return
    const started = chats.find((c) => c.turnStartedAt && c.turnStartedAt !== before.get(c.key))
    const finished = [...before].some(([key, turn]) => turn && !chats.find((c) => c.key === key)?.turnStartedAt)
    if (started) playWhip(started.cwd)
    if (finished) {
      if (busy.current) thumbsPending.current = true
      else playThumbs()
    }
    // playWhip/playThumbs só mexem em refs e setters estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats])

  const pose: Pose =
    action === 'go' || action === 'back'
      ? 'walk'
      : action === 'whip'
        ? 'whip'
        : action === 'thumbs'
          ? 'thumbs'
          : typing
            ? 'listen'
            : unreadCount > 0 || chats.some((c) => c.status === 'needs-you')
              ? 'wave'
              : chats.some(isWorking)
                ? 'dance'
                : 'idle'

  return (
    <div
      aria-hidden="true"
      className="mascot-walker pointer-events-none fixed left-0 top-0 z-20 will-change-transform"
      style={{
        width: WIDTH,
        height: HEIGHT,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: `transform ${moveMs}ms linear`
      }}
    >
      {/* Pendurado na mão enquanto é arrastado: inclina um pouco. */}
      <div
        className="h-full w-full transition-[rotate] duration-150"
        style={{
          transform: faceLeft ? 'scaleX(-1)' : undefined,
          rotate: dragging ? '-8deg' : '0deg',
          transformOrigin: `${toPx(BODY_X)}px ${toPy(10)}px`
        }}
      >
        <MascotFigure pose={pose} />
      </div>
      <div
        title={tr('Arraste para mudar o lugar - dois cliques voltam ao canto', 'Drag to move - double-click to send it back to the corner')}
        className={`pointer-events-auto absolute touch-none select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ left: BODY_BOX.x, top: BODY_BOX.y, width: BODY_BOX.w, height: BODY_BOX.h }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />
    </div>
  )
}

const isWorking = (c: ActiveChat) => c.status === 'running'

// Alguém digitando num campo de texto longo (caixa do chat, terminal) nesta janela.
function useTyping(): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    let timer = 0
    const onInput = (e: Event) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return
      setTyping(true)
      clearTimeout(timer)
      timer = window.setTimeout(() => setTyping(false), TYPING_MS)
    }
    document.addEventListener('input', onInput, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('input', onInput, true)
    }
  }, [])
  return typing
}

// Mesma pasta com barra de qualquer tipo no fim; no Windows, sem diferenciar maiúsculas.
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => {
    const path = p.replace(/\\/g, '/').replace(/\/+$/, '')
    return IS_WIN ? path.toLowerCase() : path
  }
  return norm(a) === norm(b)
}

// Onde parar: com a ponta do chicote (no estalo) encostando no cabeçalho da pasta (nome e caminho),
// e não na lista de conversas logo abaixo. Nulo se a pasta não está na tela.
function targetFor(cwd: string, nodes: CanvasNode[]): Point | null {
  const node = nodes.find((n) => n.type === 'project' && samePath(n.data.path, cwd))
  if (!node) return null
  const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(node.id)}"]`)
  const card = el?.getBoundingClientRect()
  if (!el || !card || card.right < 0 || card.left > window.innerWidth || card.bottom < 0 || card.top > window.innerHeight) return null
  const header = el.querySelector('header')?.getBoundingClientRect() ?? card
  const x = header.left + 4 - toPx(LASH_TIP.x)
  const minX = MARGIN - toPx(LEFT_EDGE)
  // No estalo o corpo inclina para a frente e a ponta desce uns 3 px.
  const y = header.top + header.height / 2 - 3 - toPy(LASH_TIP.y)
  return {
    x: Math.max(minX, Math.min(window.innerWidth - WIDTH, x)),
    y: Math.max(MARGIN, Math.min(window.innerHeight - HEIGHT - MARGIN, y))
  }
}
