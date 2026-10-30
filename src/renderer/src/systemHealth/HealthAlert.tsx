import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TriangleAlert } from 'lucide-react'
import { Presence } from '../motion'
import { NavButton } from '../ui/NavButton'
import { HealthModal } from './HealthModal'
import { isFresh, lowered, NOTHING_SEEN, seenOf, severityOf, type HealthSeen } from './severity'
import { useSystemHealth } from './store'
import { headline } from './texts'

// Ao lado do nome Argus na barra de cima: o alerta de memória ou disco do computador. Amarelo
// chegando no limite; vermelho no limite ou com algo já encerrado por ele. Pulsa até você abrir, e
// de novo quando piora ou algo novo para. O clique abre os números e o que foi afetado.
export function HealthAlert() {
  const state = useSystemHealth()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<HealthSeen>(NOTHING_SEEN)
  // Melhorou depois de visto: piorar de novo volta a pulsar.
  if (state) {
    const next = lowered(state, seen)
    if (next !== seen) setSeen(next)
  }
  const severity = state ? severityOf(state) : null
  const fresh = !!state && isFresh(state, seen)
  const show = () => {
    if (state) setSeen(seenOf(state))
    setOpen(true)
  }

  return (
    <>
      {state && severity && (
        // Fora da área que arrasta a janela, senão o botão não recebe o mouse.
        <span className="no-drag flex">
          <NavButton label={headline(state)} compact side="bottom-end" onClick={show}>
            <TriangleAlert
              size={14}
              className={`${severity === 'critical' ? 'text-danger' : 'text-needs-you'} ${fresh ? 'motion-safe:animate-pulse' : ''}`}
            />
          </NavButton>
        </span>
      )}
      {/* No body: dentro da barra, o modal ficaria preso na camada (z-35) dela. */}
      {createPortal(<Presence kind="modal">{open && <HealthModal onClose={() => setOpen(false)} />}</Presence>, document.body)}
    </>
  )
}
