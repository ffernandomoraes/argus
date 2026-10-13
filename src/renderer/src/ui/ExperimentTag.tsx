import { tr } from '../i18n'

// Selo dos recursos ligados em Configurações > Experimentos, na frente do nome deles. Na cor do
// texto em volta: serve na linha comum e na selecionada (fundo de destaque).
export function ExperimentTag() {
  return (
    <span className="shrink-0 rounded-[4px] border border-current px-1 text-[10px] font-medium leading-[14px] opacity-70">
      {tr('Experimento', 'Experiment')}
    </span>
  )
}
