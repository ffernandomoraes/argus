import { useEffect, useState } from 'react'
import type { ActiveChat, MascotAlerts } from '../../../../shared/chat'
import type { Pose } from './MascotFigure'

// O que o mascote mostra quando não está fazendo nada de especial (golpe, joia do fim, andando).
// Vale para os dois mascotes: o solto na tela (MascotOverlay) e o de dentro do canvas (Mascot).

export const THUMBS_MS = 2200
// Trabalhando: troca de animação a cada tanto.
const WORK_POSES: Pose[] = ['think', 'type', 'search', 'dance']
const WORK_SWITCH_MS = 7000

export const isWorking = (c: ActiveChat) => c.status === 'running'

// Com várias conversas, vale a de cima na lista; trabalhando fica acima da resposta não vista, para
// as respostas esquecidas no canvas não esconderem o trabalho.
// - alguém escrevendo um pedido: mão na orelha, escutando;
// - conversa perguntando algo (ou pedindo permissão): ombros para cima, com interrogações;
// - conversa parou com erro e você não viu: acena, com o aviso vermelho;
// - conversa trabalhando: pensando, digitando, procurando com a lupa ou dançando;
// - resposta não vista: joia com o check verde;
// - nada acontecendo: parado, piscando.
export function restingPose({ chats, alerts, typing, workPose }: { chats: ActiveChat[]; alerts: MascotAlerts; typing: boolean; workPose: Pose }): Pose {
  if (typing) return 'listen'
  if (chats.some((c) => c.status === 'needs-you')) return 'ask'
  if (alerts.failed.length > 0) return 'wave'
  if (chats.some(isWorking)) return workPose
  if (alerts.done > 0) return 'thumbs'
  return 'idle'
}

// Animação do trabalho: começa por uma qualquer e troca por outra diferente a cada tanto.
export function useWorkPose(working: boolean): Pose {
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
export function useAlerts(): MascotAlerts {
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
