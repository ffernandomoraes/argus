import type { ProblemReport } from '../report'
import { handle, on } from './register'

// Reportar problema: começar, parar e voltar ao formulário. O andamento chega pelo report:state.
export function registerReportIpc(report: ProblemReport): void {
  handle('report:state', () => report.state)
  on('report:start', (_e, problem) => report.start(problem))
  on('report:stop', () => report.stop())
  on('report:reset', () => report.reset())
}
