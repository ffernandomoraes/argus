import { useEffect, useState } from 'react'
import type { ReportState } from '../../../shared/report'

const IDLE: ReportState = { status: 'idle' }

// Estado da investigação, que mora no processo principal (continua com o modal fechado e é a mesma
// em todas as janelas). A resposta do pedido inicial pode chegar depois de um aviso mais novo: aí
// ela é velha e fica de fora.
export function useReportState(): ReportState {
  const [state, setState] = useState<ReportState>(IDLE)
  useEffect(() => {
    let alive = true
    let heard = false
    const off = window.api.report.onState((s) => {
      heard = true
      setState(s)
    })
    window.api.report.state().then(
      (s) => alive && !heard && setState(s),
      (err: unknown) => console.error('[report] estado:', err)
    )
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}
