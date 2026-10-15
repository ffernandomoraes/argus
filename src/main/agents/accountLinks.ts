import { lstatSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ProviderId } from '../../shared/providers'
import { errorMessage } from '../lib/errors'
import { globalDir } from './folder'

// As contas extras do Codex e do Gemini têm pasta própria (CODEX_HOME, GEMINI_CLI_HOME), e o CLI
// procura os agentes globais dentro dela. A pasta de agentes da conta aponta para a biblioteca (a
// da conta principal): um agente criado no Argus vale em todas as contas, como no Claude.
// O Cursor não entra: os agentes dele vão no texto da mensagem.
function accountAgentsDir(provider: ProviderId, accountDir: string): string | null {
  if (provider === 'codex') return join(accountDir, 'agents')
  if (provider === 'gemini') return join(accountDir, '.gemini', 'agents')
  return null
}

const present = (path: string): boolean => {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

// Roda antes de cada CLI da conta abrir. O que já estiver lá (o link, ou uma pasta que a pessoa
// criou) fica como está. No Windows, junction: não pede administrador.
export function linkAgentsDir(provider: ProviderId, accountDir: string): void {
  const path = accountAgentsDir(provider, accountDir)
  if (!path || present(path)) return
  try {
    const target = globalDir(provider)
    mkdirSync(target, { recursive: true })
    mkdirSync(dirname(path), { recursive: true })
    symlinkSync(target, path, 'junction')
  } catch (err) {
    console.warn('[agentes] não deu para ligar a biblioteca à conta:', path, errorMessage(err))
  }
}

// Antes de apagar a pasta da conta: tira o link, para nada alcançar a biblioteca.
export function unlinkAgentsDir(provider: ProviderId, accountDir: string): void {
  const path = accountAgentsDir(provider, accountDir)
  if (!path) return
  try {
    if (lstatSync(path).isSymbolicLink()) unlinkSync(path)
  } catch {
    // Sem link, nada a tirar.
  }
}
