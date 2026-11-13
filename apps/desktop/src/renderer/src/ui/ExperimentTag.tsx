import { FlaskConical } from 'lucide-react'
import { tr } from '../i18n'

// Selo dos recursos ligados em Configurações > Experimentos, na frente do nome deles: só o frasco,
// cinza e sem fundo, como os ícones soltos da barra do projeto. O nome fica no title, ao passar o mouse.
export function ExperimentTag() {
  const label = tr('Experimento', 'Experiment')
  return (
    <span title={label} className="inline-flex shrink-0 items-center opacity-60">
      <FlaskConical size={12} aria-label={label} />
    </span>
  )
}
