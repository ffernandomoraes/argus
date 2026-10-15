import { useStore } from '../lib/useStore'
import { Presence } from '../motion'
import { closeReport, reportStore } from './reportStore'
import { ReportModal } from './ReportModal'

// O modal de reportar problema da janela (canvas ou conversa separada), aberto por openReport.
export function ReportHost() {
  const { open, request } = useStore(reportStore)
  return <Presence kind="modal">{open && <ReportModal request={request} onClose={closeReport} />}</Presence>
}
