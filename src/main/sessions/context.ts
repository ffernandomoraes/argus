import { stat } from 'node:fs/promises'
import { contextWindowFor } from '../contextWindows'
import { sessionFile } from '../transcripts/projectDir'
import { readTail, type Usage } from './tail'

// Quanto da janela de contexto a conversa ocupa, de 0 a 100. Calculado na hora de mostrar: a
// janela real de cada modelo é aprendida ao usar o chat (contextWindows.ts) e muda o resultado.
export function percentOf(usage: Usage | undefined): number {
  return usage ? Math.min(100, Math.round((usage.tokens / contextWindowFor(usage.model)) * 100)) : 0
}

// Quanto da janela de contexto uma conversa ocupa agora (o protótipo do modo design, que não entra
// na lista da pasta).
export async function sessionContext(projectPath: string, id: string): Promise<number> {
  const file = sessionFile(projectPath, id)
  if (!file) return 0
  try {
    const { size } = await stat(file)
    return percentOf((await readTail(file, size, false)).usage)
  } catch {
    return 0
  }
}
