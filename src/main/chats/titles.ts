import { listSessions } from '../sessions'

// Títulos das conversas de uma pasta, lidos dos arquivos das sessões: id da sessão → título.
// Sem conseguir ler, vazio (quem mostra usa o texto padrão, ver titleOf).
export async function sessionTitles(cwd: string): Promise<Map<string, string>> {
  try {
    return new Map((await listSessions(cwd)).map((s) => [s.id, s.title]))
  } catch {
    return new Map()
  }
}
