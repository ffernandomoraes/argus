import { useState } from 'react'
import { X } from 'lucide-react'
import type { AuthState } from '../../../shared/auth'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Modal } from '../ui/Modal'
import { setupReady } from './SetupStep'
import { welcomeSteps } from './steps'

// Boas-vindas em até 5 etapas: o que o Argus faz e, por último, a configuração do Claude Code.
// startAtSetup: já viu o passo a passo e só falta configurar (sem login, Claude desinstalado).
// Só fecha com a configuração pronta: sem ela, o canvas não funciona. Antes disso, o X leva à
// configuração, e o Esc fica aqui (não fecha o drawer que está atrás).
export function WelcomeModal({ auth, startAtSetup, onDone }: { auth: AuthState; startAtSetup: boolean; onDone: () => void }) {
  const list = welcomeSteps(auth)
  const last = list.length - 1
  const [index, setIndex] = useState(startAtSetup ? last : 0)
  const ready = setupReady(auth)
  const step = list[index]
  const closeBlocked = !ready && index === last

  return (
    <Modal variant="blocking" className="flex flex-col" label="Boas-vindas ao Argus" onClose={onDone} onRequestClose={() => ready}>
      <IconButton
        label="Fechar"
        title={ready ? 'Fechar' : closeBlocked ? 'Termine a configuração para fechar' : 'Ir para a configuração'}
        variant="subtle"
        disabled={closeBlocked}
        onClick={() => (ready ? onDone() : setIndex(last))}
        className="absolute right-3 top-3 z-10"
      >
        <X size={15} />
      </IconButton>
      {/* Topo com folga para o X não cobrir a ilustração. */}
      <div key={index} className="welcome-step min-h-0 flex-1 overflow-y-auto px-6 pt-12 pb-4">
        {/* Pontos do canvas em toda a moldura, também nas laterais que a ilustração não cobre. */}
        <div
          className="h-[170px] overflow-hidden rounded-xl border border-line bg-bg"
          style={{ backgroundImage: 'radial-gradient(var(--color-dots) 1px, transparent 1.2px)', backgroundSize: '12px 12px' }}
        >
          {step.art}
        </div>
        <p className="mt-5 text-[12px] font-medium uppercase tracking-wide text-faint">
          {index + 1} de {list.length}
        </p>
        <h1 className="mt-1 text-lg font-semibold text-text">{step.title}</h1>
        <div className="mt-2 text-sm leading-relaxed text-muted">{step.body}</div>
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-line px-6 py-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Etapas">
          {list.map((s, i) => (
            <button
              key={s.title}
              role="tab"
              aria-selected={i === index}
              aria-label={s.title}
              title={s.title}
              onClick={() => setIndex(i)}
              // rounded-md, a regra dos botões: com 6 px de altura, o canto já fecha em pílula.
              className={`h-1.5 rounded-md transition-all ${i === index ? 'w-5 bg-text' : 'w-1.5 bg-line-strong hover:bg-muted'}`}
            />
          ))}
        </div>
        <div className="flex-1" />
        {index > 0 && (
          <Button size="xl" onClick={() => setIndex(index - 1)}>
            Voltar
          </Button>
        )}
        {index < last ? (
          <Button size="xl" variant="primary" onClick={() => setIndex(index + 1)}>
            Próximo
          </Button>
        ) : (
          <Button size="xl" variant="primary" disabled={!ready} onClick={onDone} title={ready ? undefined : 'Termine a configuração acima'}>
            Começar
          </Button>
        )}
      </footer>
    </Modal>
  )
}
