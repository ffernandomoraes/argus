import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ActiveChat, MascotAlerts } from '../../../../shared/chat'
import { tr } from '../../i18n'
import { IS_MAC } from '../../platform'
import { getPreferences, usePreference } from '../../settings/preferences'
import { useActiveChats } from '../activeChats'
import { STRIKES } from './look'
import { MascotFigure, VIEW, type Pose } from './MascotFigure'

// A página da janela do mascote solto na tela (#mascot; a janela é criada por
// src/main/app/mascotOverlay.ts). Ela é do tamanho do quadro dele, transparente, e o clique
// atravessa até o ponteiro entrar no boneco. O que ele faz, com todas as conversas do app:
// - pedido enviado: dá o golpe escolhido ali mesmo;
// - conversa terminou bem: joia com check verde (e fica assim enquanto houver resposta não vista);
// - alguém escrevendo um pedido no app: mão na orelha, escutando;
// - conversa perguntando algo (ou pedindo permissão): ombros para cima, com interrogações;
// - conversa parou com erro e você não viu: acena, com o aviso vermelho;
// - conversa trabalhando: pensando, digitando no notebook, procurando com a lupa ou dançando,
//   trocando de tempos em tempos;
// - nada acontecendo: parado, piscando.
// Com várias conversas, vale a de cima na lista; trabalhando fica acima da resposta não vista, para
// as respostas esquecidas no canvas não esconderem o trabalho.
// Arrastar muda o lugar (fica guardado); dois cliques voltam ao canto de baixo da tela principal.
// No Mac quem arrasta é o sistema (o boneco é área de arrastar, como uma barra de título): pela
// página, o clique ativava o Argus. Lá, voltar ao canto é pelo botão da aba Mascote.

const THUMBS_MS = 2200
// Trabalhando: troca de animação a cada tanto.
const WORK_POSES: Pose[] = ['think', 'type', 'search', 'dance']
const WORK_SWITCH_MS = 7000
// Parte do quadro onde está o boneco (o resto é o espaço do chicote), em unidades do desenho: é
// nela que o ponteiro pega o clique.
const BODY = { x0: 22, x1: 98, y0: 2, y1: 152 }
// Arrastar menos que isso é clique, não muda o lugar.
const DRAG_MIN = 3

type Action = 'strike' | 'thumbs' | null

export function MascotOverlay() {
  const look = usePreference('mascotLook')
  const chats = useActiveChats()
  const alerts = useAlerts()
  const typing = useTypingSignal()
  // As conversas com erro, na hora em que a lista de ativas muda (o aviso chega antes dela).
  const failed = useRef(alerts.failed)
  failed.current = alerts.failed

  const [action, setAction] = useState<Action>(null)
  // Fila: um envio com outra ação em andamento é ignorado; a joia espera o golpe acabar.
  const busy = useRef(false)
  const thumbsPending = useRef(false)
  const timers = useRef<number[]>([])
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const playThumbs = () => {
    busy.current = true
    thumbsPending.current = false
    setAction('thumbs')
    later(THUMBS_MS, () => {
      busy.current = false
      setAction(null)
    })
  }

  const playStrike = () => {
    if (busy.current) return
    busy.current = true
    setAction('strike')
    later(STRIKES[getPreferences().mascotLook.strike].ms, () => {
      busy.current = false
      setAction(null)
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
    const started = chats.some((c) => c.turnStartedAt && c.turnStartedAt !== before.get(c.key))
    // Parou com erro não é joia: o aviso vermelho já aparece.
    const finished = [...before].some(([key, turn]) => turn && !chats.find((c) => c.key === key)?.turnStartedAt && !failed.current.includes(key))
    if (started) playStrike()
    if (finished) {
      if (busy.current) thumbsPending.current = true
      else playThumbs()
    }
    // playStrike/playThumbs só mexem em refs e setters estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats])

  const drag = useDrag()
  const working = chats.some(isWorking)
  const workPose = useWorkPose(working)

  const pose: Pose =
    action === 'strike'
      ? look.strike
      : action === 'thumbs'
        ? 'thumbs'
        : typing
          ? 'listen'
          : chats.some((c) => c.status === 'needs-you')
            ? 'ask'
            : alerts.failed.length > 0
              ? 'wave'
              : working
                ? workPose
                : alerts.done > 0
                  ? 'thumbs'
                  : 'idle'

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none h-full w-full" style={{ rotate: drag.dragging ? '-8deg' : '0deg', transition: 'rotate 150ms' }}>
        <MascotFigure pose={pose} look={look} />
      </div>
      {IS_MAC ? (
        <div className="drag absolute" style={drag.box} />
      ) : (
        <div
          title={tr('Arraste para mudar o lugar - dois cliques voltam ao canto', 'Drag to move - double-click to send it back to the corner')}
          className={`absolute touch-none select-none ${drag.dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={drag.box}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerUp}
          onDoubleClick={() => window.api.mascot.home()}
        />
      )}
    </div>
  )
}

const isWorking = (c: ActiveChat) => c.status === 'running'

// Arrastar a janela pelo boneco, e pegar o clique só enquanto o ponteiro está em cima dele (fora,
// o clique vai para o app de baixo).
function useDrag() {
  const [dragging, setDragging] = useState(false)
  const grab = useRef<{ dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null)
  const hover = useRef(false)

  // A janela tem o tamanho do quadro: px por unidade do desenho.
  const scale = window.innerWidth / VIEW.w
  const box = {
    left: (BODY.x0 - VIEW.x) * scale,
    top: (BODY.y0 - VIEW.y) * scale,
    width: (BODY.x1 - BODY.x0) * scale,
    height: (BODY.y1 - BODY.y0) * scale
  }

  useEffect(() => {
    // No Mac quem vê o ponteiro no boneco é o processo principal (ver MascotOverlay no main).
    if (IS_MAC) return
    const setHover = (on: boolean) => {
      if (on === hover.current) return
      hover.current = on
      window.api.mascot.setInteractive(on)
    }
    const onMove = (e: MouseEvent) => {
      if (grab.current) return
      setHover(e.clientX >= box.left && e.clientX <= box.left + box.width && e.clientY >= box.top && e.clientY <= box.top + box.height)
    }
    const onLeave = () => {
      if (!grab.current) setHover(false)
    }
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    // O processo principal viu o ponteiro sair do boneco e devolveu o clique ao app de baixo.
    const offReleased = window.api.mascot.onReleased(() => {
      hover.current = false
    })
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      offReleased()
    }
  }, [box.left, box.top, box.width, box.height])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    grab.current = { dx: e.clientX, dy: e.clientY, x0: e.screenX, y0: e.screenY, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const g = grab.current
    if (!g) return
    if (!g.moved && Math.hypot(e.screenX - g.x0, e.screenY - g.y0) < DRAG_MIN) return
    if (!g.moved) {
      g.moved = true
      setDragging(true)
    }
    window.api.mascot.dragTo(e.screenX - g.dx, e.screenY - g.dy)
  }
  const onPointerUp = () => {
    const g = grab.current
    grab.current = null
    if (!g?.moved) return
    setDragging(false)
    window.api.mascot.dragEnd()
  }
  return { dragging, box, onPointerDown, onPointerMove, onPointerUp }
}

// Animação do trabalho: começa por uma qualquer e troca por outra diferente a cada tanto.
function useWorkPose(working: boolean): Pose {
  const pick = (not?: Pose) => {
    const options = WORK_POSES.filter((p) => p !== not)
    return options[Math.floor(Math.random() * options.length)]
  }
  const [pose, setPose] = useState(() => pick())
  useEffect(() => {
    if (!working) return
    const timer = window.setInterval(() => setPose((p) => pick(p)), WORK_SWITCH_MS)
    return () => clearInterval(timer)
  }, [working])
  return pose
}

const NO_ALERTS: MascotAlerts = { done: 0, failed: [] }

// Respostas não vistas e conversas com erro, como o processo principal conta.
function useAlerts(): MascotAlerts {
  const [alerts, setAlerts] = useState(NO_ALERTS)
  useEffect(() => {
    let received = false
    const off = window.api.mascot.onAlerts((a) => {
      received = true
      setAlerts(a)
    })
    void window.api.mascot.alerts().then((a) => {
      // O aviso chegou antes da resposta: ele é mais novo.
      if (!received) setAlerts(a)
    })
    return off
  }, [])
  return alerts
}

// Alguém escrevendo um pedido numa janela do app.
function useTypingSignal(): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => window.api.mascot.onTyping(setTyping), [])
  return typing
}
