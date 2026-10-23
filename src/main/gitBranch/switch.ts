import type { BranchList, BranchOption } from '../../shared/sessions'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { git } from './git'
import { currentBranch, findRepo } from './repo'
import { forgetStatus, uncommittedFiles } from './status'

// Sem terminal para digitar senha: o git desiste em vez de ficar esperando.
const NO_PROMPT = { GIT_TERMINAL_PROMPT: '0' }

// Branches locais e as que só existem no remoto, da usada mais recentemente para a mais antiga.
// A remota com o mesmo nome de uma local fica de fora (escolher a local já serve), e o
// origin/HEAD também. Pasta fora de repositório ou git com erro: nulo.
export async function listBranches(folder: string): Promise<BranchList | null> {
  const repo = await findRepo(folder)
  if (!repo) return null
  try {
    const out = await git(repo.root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname)', 'refs/heads', 'refs/remotes'], {
      maxBuffer: 8 * 1024 * 1024
    })
    const refs = out.split(/\r?\n/).filter(Boolean)
    const local = new Set(refs.filter((r) => r.startsWith('refs/heads/')).map((r) => r.slice('refs/heads/'.length)))
    const seen = new Set<string>()
    const branches: BranchOption[] = []
    for (const ref of refs) {
      if (ref.startsWith('refs/heads/')) {
        branches.push({ name: ref.slice('refs/heads/'.length) })
        continue
      }
      const rest = ref.slice('refs/remotes/'.length)
      const slash = rest.indexOf('/')
      if (slash < 0) continue
      const remote = rest.slice(0, slash)
      const name = rest.slice(slash + 1)
      if (name === 'HEAD' || local.has(name) || seen.has(name)) continue
      seen.add(name)
      branches.push({ name, remote })
    }
    return { current: await currentBranch(folder), branches }
  } catch {
    return null
  }
}

// Traz as branches novas do remoto (e esquece as apagadas lá). Devolve se deu certo; sem rede,
// sem remoto ou pedindo senha, só não atualiza.
export async function fetchBranches(folder: string): Promise<boolean> {
  const repo = await findRepo(folder)
  if (!repo) return false
  try {
    await git(repo.root, ['fetch', '--all', '--prune', '--quiet'], { timeout: 20_000, env: NO_PROMPT })
    return true
  } catch {
    return false
  }
}

// Troca para a branch (a remota vira uma local que acompanha ela) ou, com `create`, cria uma
// nova a partir da atual e vai para ela. Trocar com arquivos não comitados é bloqueado: eles
// iriam junto ou travariam a troca no meio. Criar leva as mudanças para a branch nova, sem risco.
// Devolve o erro ou nulo.
export async function checkoutBranch(folder: string, option: BranchOption, create = false): Promise<string | null> {
  const repo = await findRepo(folder)
  if (!repo) return tr('A pasta não é um repositório git.', 'This folder isn’t a git repository.')
  const { name, remote } = option
  // Nome começando com "-" viraria opção do git.
  if (!name || name.startsWith('-')) return tr('Nome de branch inválido.', 'Invalid branch name.')
  try {
    if (create) {
      await git(repo.root, ['check-ref-format', '--branch', name]).catch(() => {
        throw new Error(tr(`"${name}" não serve como nome de branch.`, `"${name}" isn’t a valid branch name.`))
      })
    } else {
      const files = await uncommittedFiles(folder)
      if (files === null) return tr('Não consegui ler o git status da pasta.', 'Couldn’t read the folder’s git status.')
      if (files.length) {
        const n = files.length
        return tr(
          `${n === 1 ? '1 arquivo não comitado' : `${n} arquivos não comitados`}. Comite ou descarte antes de trocar de branch.`,
          `${n === 1 ? '1 uncommitted file' : `${n} uncommitted files`}. Commit or discard before switching branches.`
        )
      }
    }
    const args = create
      ? ['checkout', '-b', name]
      : remote
        ? ['checkout', '-b', name, '--track', `${remote}/${name}`]
        : ['checkout', name, '--']
    await git(repo.root, args, { timeout: 30_000, env: NO_PROMPT })
    forgetStatus(folder)
    return null
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr?.trim()
    return stderr || errorMessage(err)
  }
}
