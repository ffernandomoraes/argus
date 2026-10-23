import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { ActiveChat } from '../../../../shared/chat'
import { tr } from '../../i18n'
import { getPreferences, setPreferences, usePreference } from '../../settings/preferences'
import { useActiveChatsInCanvas } from '../canvasScope'
import type { CanvasNode } from '../types'
import { STRIKES, strikeTip } from './look'
import { folderHeader, useTyping } from './MascotBridge'
import { BODY_X, LEFT_EDGE, MascotFigure, VIEW, type Pose } from './MascotFigure'
import { isWorking, restingPose, THUMBS_MS, useAlerts, useWorkPose } from './mascotState'

// Mascote dentro do canvas, com "Fixo por cima de todas as janelas" desligado na aba Mascote (ligado,
// quem aparece é o solto na tela, MascotOverlay). Fica no canto esquerdo da janela, no meio da
// altura, ou onde a pessoa arrastou. Reage às conversas das pastas deste canvas:
// - pedido enviado: anda até a pasta da conversa, dá o golpe escolhido e volta;
// - conversa terminou bem: joia com check verde;
// - no resto do tempo, o que restingPose (mascotState.ts) diz.
// Dois cliques: volta andando ao canto de sempre.

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

type Point = { x: number; y: number }
type Action = 'go' | 'strike' | 'back' | 'thumbs' | null

export function Mascot({ nodesRef, hidden }: { nodesRef: RefObject<CanvasNode[]>; hidden: boolean }) {
  const on = usePreference('mascot')
  const floating = usePreference('mascotFloating')
  if (!on || floating || hidden) return null
  return <MascotView nodesRef={nodesRef} />
}

// Parte do quadro onde está o boneco (o resto é espaço do chicote): é por ela que se arrasta.
const BODY_BOX = { x: toPx(24), y: toPy(14), w: toPx(96) - toPx(24), h: toPy(150) - toPy(14) }
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
  const spot = getPreferences().mascotCanvasSpot
  if (spot) return clampToWindow({ x: spot.x * window.innerWidth, y: spot.y * window.innerHeight })
  return { x: MARGIN - toPx(LEFT_EDGE), y: Math.round(window.innerHeight / 2 - HEIGHT / 2) }
}

function MascotView({ nodesRef }: { nodesRef: RefObject<CanvasNode[]> }) {
  // Só o que está no canvas desta janela (ver canvasScope).
  const chats = useActiveChatsInCanvas()
  const alerts = useAlerts()
  const typing = useTyping()
  const look = usePreference('mascotLook')
  const workPose = useWorkPose(chats.some(isWorking))
  // As conversas com erro, na hora em que a lista de ativas muda (o aviso chega antes dela).
  const failed = useRef(alerts.failed)
  failed.current = alerts.failed

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

  // Volta ao lugar dele quando a janela muda de tamanho (parado em casa).
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

  const playStrike = (chat: ActiveChat) => {
    if (busy.current) return
    busy.current = true
    const look = getPreferences().mascotLook
    const start = home()
    const target = targetFor(chat.cwd, nodesRef.current ?? [], strikeTip(look))
    // Pasta fora da tela (ou conversa sem pasta no canvas): golpe ali mesmo.
    const goMs = target ? walk(start, target) : 0
    setAction(target ? 'go' : 'strike')
    later(goMs, () => {
      setFaceLeft(false)
      setAction('strike')
      later(STRIKES[look.strike].ms, () => {
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
  // golpeando, não dá para pegar.
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
      setPreferences({ mascotCanvasSpot: { x: p.x / window.innerWidth, y: p.y / window.innerHeight } })
    }
    grab.current = null
    busy.current = false
    setDragging(false)
    if (thumbsPending.current) playThumbs()
  }
  // Dois cliques: volta andando ao canto de sempre.
  const onDoubleClick = () => {
    if (busy.current) return
    setPreferences({ mascotCanvasSpot: null })
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

  // "Trazer para o canto" na aba Mascote zera o lugar: volta para casa na hora.
  const spot = usePreference('mascotCanvasSpot')
  useEffect(() => {
    if (busy.current) return
    setMoveMs(0)
    setPos(home())
  }, [spot])

  // Envio e fim de pedido saem da lista de conversas ativas: pedido novo = turnStartedAt novo;
  // fim = a conversa sai da lista ou fica só com tarefas em segundo plano.
  const seen = useRef<Map<string, number | undefined> | null>(null)
  useEffect(() => {
    const before = seen.current
    seen.current = new Map(chats.map((c) => [c.key, c.turnStartedAt]))
    if (!before) return
    const started = chats.find((c) => c.turnStartedAt && c.turnStartedAt !== before.get(c.key))
    // Parou com erro não é joia: o aviso vermelho já aparece.
    const finished = [...before].some(([key, turn]) => turn && !chats.find((c) => c.key === key)?.turnStartedAt && !failed.current.includes(key))
    if (started) playStrike(started)
    if (finished) {
      if (busy.current) thumbsPending.current = true
      else playThumbs()
    }
    // playStrike/playThumbs só mexem em refs e setters estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats])

  const pose: Pose =
    action === 'go' || action === 'back'
      ? 'walk'
      : action === 'strike'
        ? look.strike
        : action === 'thumbs'
          ? 'thumbs'
          : restingPose({ chats, alerts, typing, workPose })

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
        <MascotFigure pose={pose} look={look} />
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

// Onde parar: com a ponta do golpe (do chicote no estalo, da mão, do pé, da bola do hadouken)
// encostando no cabeçalho da pasta (nome e caminho). Nulo se a pasta não está na tela.
function targetFor(cwd: string, nodes: CanvasNode[], tip: Point): Point | null {
  const header = folderHeader(cwd, nodes)
  if (!header) return null
  const x = header.x + 4 - toPx(tip.x)
  const minX = MARGIN - toPx(LEFT_EDGE)
  // No golpe o corpo inclina e a ponta desce uns 3 px.
  const y = header.y + header.height / 2 - 3 - toPy(tip.y)
  return {
    x: Math.max(minX, Math.min(window.innerWidth - WIDTH, x)),
    y: Math.max(MARGIN, Math.min(window.innerHeight - HEIGHT - MARGIN, y))
  }
}
