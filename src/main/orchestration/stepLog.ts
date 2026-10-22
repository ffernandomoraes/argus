import { appendFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { errorMessage } from '../lib/errors'

// Registro de cada etapa delegada e de cada veredito de validação, uma linha JSON por evento. É a
// base para o Argus saber, pelo uso real, qual agente e modelo vai bem em cada tipo de tarefa.

export type StepRecord = {
  type: 'step'
  id: string
  at: string
  orchestrator: string
  agent: string
  model: string
  effort: string
  rule?: string
  title?: string
  readOnly: boolean
  validates?: string
  outcome: 'ok' | 'error' | 'cancelled'
  error?: string
  durationMs: number
  tokens?: number
  cwd: string
}

export type VerdictRecord = { type: 'verdict'; at: string; step: string; passed: boolean; note?: string; orchestrator: string }

const file = () => join(homedir(), app.isPackaged ? '.argus' : '.argus-dev', 'orchestration', 'steps.jsonl')

export async function recordStep(r: StepRecord | VerdictRecord): Promise<void> {
  try {
    await mkdir(join(file(), '..'), { recursive: true })
    await appendFile(file(), JSON.stringify(r) + '\n')
  } catch (err) {
    console.warn('[orchestration] não deu para gravar a etapa:', errorMessage(err))
  }
}
