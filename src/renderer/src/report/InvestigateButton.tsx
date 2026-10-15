import { useContext } from 'react'
import { Bug } from 'lucide-react'
import { Button } from '../ui/Button'
import { tr } from '../i18n'
import { openReport, ReportContext, type ReportRequest } from './reportStore'

// "Investigar" ao lado de um erro: abre o reportar problema com o erro e o lugar onde ele apareceu
// (pasta, conta e conversa vêm de quem mostra o erro, pelo ReportContext, ou direto nas props).
export function InvestigateButton({ error, ...request }: ReportRequest & { error: string }) {
  const around = useContext(ReportContext)
  return (
    <Button size="sm" variant="ghost" className="-my-0.5" onClick={() => openReport({ ...around, ...request, error })}>
      <Bug size={12} />
      {tr('Investigar', 'Investigate')}
    </Button>
  )
}
