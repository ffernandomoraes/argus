import { existsSync, readdirSync } from 'node:fs'
import { arch, homedir, release } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import type { AuthState } from '../../shared/auth'
import type { ClaudeVersionState } from '../../shared/claudeVersion'
import type { ReportProblem } from '../../shared/report'
import { ROOT } from '../accounts/paths'
import { lang } from '../i18n'
import { IS_MAC, IS_WIN } from '../platform'
import { distroFor } from '../wsl'
import { wslDiagnostics } from '../wsl/diagnostics'
import { appLogLines } from './appLog'

// O que o app sabe da máquina, em texto: vai para o Claude que investiga e, no fim, junto do
// relatório (ver index.ts). Sem nada de login: o relatório passa pelo scrub antes de sair.

export type ContextSources = { auth: () => AuthState; claudeVersion: () => ClaudeVersionState }

const yes = (b: boolean) => (b ? 'sim' : 'não')
const systemName = () => (IS_MAC ? 'macOS' : IS_WIN ? 'Windows' : 'Linux')

// Onde roda o `claude` de uma pasta (ou, sem pasta, o do app: login, uso, esta investigação).
export function placeOf(cwd?: string): string {
  const distro = distroFor(cwd)
  return distro ? `WSL (${distro})` : systemName()
}

function accountLines(auth: AuthState): string[] {
  return auth.accounts.map((a) => {
    const s = a.status
    const login = !s ? 'não conferido' : s.loggedIn ? `sim (${[s.method, s.subscriptionType, s.email].filter(Boolean).join(', ')})` : 'não'
    const tags = [a.id === auth.defaultId ? 'padrão' : '', a.dir ? `pasta=${a.dir}` : 'pasta=~/.claude'].filter(Boolean).join(' ')
    return `- ${a.id} "${a.name}" ${tags} login=${login}`
  })
}

// As pastas de conta no disco, com e sem login guardado (no Mac o login fica nas Chaves, fora dela).
function accountFolders(): string[] {
  let ids: string[]
  try {
    ids = readdirSync(ROOT)
  } catch {
    return [`(${ROOT} não existe)`]
  }
  return ids.map((id) => {
    const dir = join(ROOT, id)
    return `- ${id}: .credentials.json=${yes(existsSync(join(dir, '.credentials.json')))} .claude.json=${yes(existsSync(join(dir, '.claude.json')))}`
  })
}

function problemLines(p: ReportProblem): string[] {
  const lines = [`Descrição: ${p.description.trim() || '(sem descrição)'}`]
  if (p.error) lines.push(`Erro na tela: ${p.error}`)
  if (p.where) lines.push(`Onde: ${p.where}`)
  if (p.cwd) lines.push(`Pasta: ${p.cwd} (o Claude dela roda em ${placeOf(p.cwd)})`)
  if (p.account) lines.push(`Conta do grupo: ${p.account}`)
  if (p.sessionId) lines.push(`Conversa: ${p.sessionId}`)
  return lines
}

export async function collectContext(sources: ContextSources, problem?: ReportProblem): Promise<string> {
  const auth = sources.auth()
  const version = sources.claudeVersion()
  const binaries = [version.current, ...version.others].filter((b) => !!b)
  const lines = [
    `Argus ${app.getVersion()} (${app.isPackaged ? 'instalado' : 'desenvolvimento'}) - ${systemName()} ${release()} ${arch()} - idioma ${lang()}`,
    `Data: ${new Date().toISOString()}`,
    `Pasta do usuário: ${homedir()}`,
    '',
    ...(problem ? ['== Problema', ...problemLines(problem), ''] : []),
    '== Claude Code',
    `Instalação: ${auth.claude.status}${auth.claude.message ? ` (${auth.claude.message})` : ''}`,
    ...binaries.map((b) => `- ${b.path} ${b.version ?? 'versão desconhecida'} (${b.source})${b === version.current ? ' [usado pelo app]' : ''}`),
    `Mais nova publicada: ${version.latest ?? 'desconhecida'}`,
    `O Claude do app (login, uso, esta investigação) roda em: ${placeOf()}`,
    '',
    '== Contas no app',
    ...accountLines(auth),
    '',
    `== Pastas de conta (${ROOT})`,
    ...accountFolders(),
    `~/.claude/.credentials.json existe: ${yes(existsSync(join(homedir(), '.claude', '.credentials.json')))}`
  ]
  if (IS_WIN) lines.push('', '== WSL', await wslDiagnostics())
  const log = appLogLines()
  lines.push('', '== Avisos e erros do app (mais recentes por último)', ...(log.length ? log : ['(nenhum)']))
  return lines.join('\n')
}
