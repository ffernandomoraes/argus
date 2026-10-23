import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { slugify, type WorktreeInfo, type WorktreeReserved } from '../../shared/worktrees'
import { git } from '../gitBranch/git'
import { currentBranch, findRepo } from '../gitBranch/repo'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { expandHome } from '../paths'
import { packageManager } from '../projectServers/scripts'
import { worktreeFolder } from './paths'
import { runInFolder } from './run'
import { rememberWorktree, updateWorktree, worktreeOf } from './store'

const NO_PROMPT = { GIT_TERMINAL_PROMPT: '0' }

// .env, .env.local, .env.development...: o que o projeto precisa para rodar e o git não leva.
const ENV_FILE = /^\.env(\..+)?$/

// Situação de cada worktree enquanto o app está aberto: criando/instalando, ou o erro.
export const preparing = new Set<string>()
export const failures = new Map<string, string>()

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  )

// "Nova tarefa em paralelo": reserva a pasta, sem criar nada ainda. A tarefa sai da branch em que a
// pasta principal está agora. O card filho aparece na hora; o worktree nasce no primeiro envio da
// conversa (materialize), quando já dá para tirar um nome provisório do pedido.
export async function reserveWorktree(folder: string): Promise<WorktreeReserved> {
  const full = resolve(expandHome(folder))
  const repo = await findRepo(full)
  if (!repo) return { ok: false, error: tr('A pasta não é um repositório git.', 'This folder isn’t a git repository.') }
  // Pedida a partir de outro worktree: a nova também é do repositório principal.
  const parent = worktreeOf(repo.root)
  const main = parent?.main ?? repo.root
  const base = await currentBranch(repo.root)
  if (!base) return { ok: false, error: tr('A pasta não está numa branch (HEAD solto).', 'The folder isn’t on a branch (detached HEAD).') }
  const dir = await worktreeFolder(main)
  rememberWorktree({ path: dir, main, base, pending: true })
  // Card aberto numa pasta dentro do repositório (apps/checkout): o filho abre na mesma pasta da cópia.
  const inner = relative(repo.root, full)
  return { ok: true, path: inner ? join(dir, inner) : dir, base }
}

// Branch provisória a partir do pedido: wip/melhorar-o-checkout. O agente renomeia seguindo a
// convenção do repositório (ver o aviso em shared/worktrees.ts).
async function freeBranch(main: string, text: string, dir: string): Promise<string> {
  const slug = slugify(text.split('\n')[0] ?? '', 40) || basename(dir)
  for (let n = 1; ; n++) {
    const name = `wip/${slug}${n === 1 ? '' : `-${n}`}`
    const taken = await git(main, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).then(
      () => true,
      () => false
    )
    if (!taken) return name
  }
}

const running = new Map<string, Promise<void>>()

// Cria de fato o worktree reservado (git worktree add a partir da base), copia os .env e instala as
// dependências em segundo plano. Chamado antes de a primeira mensagem (ou o terminal) abrir na
// pasta; já criado, não faz nada. Falha fica em `failures`, para o card mostrar.
export function materializeWorktree(cwd: string, text: string): Promise<void> {
  const info = worktreeOf(cwd)
  if (!info?.pending) return Promise.resolve()
  let job = running.get(info.path)
  if (!job) {
    job = create(info, text).finally(() => running.delete(info.path))
    running.set(info.path, job)
  }
  return job
}

async function create(info: WorktreeInfo, text: string): Promise<void> {
  preparing.add(info.path)
  failures.delete(info.path)
  try {
    const branch = await freeBranch(info.main, text, info.path)
    await mkdir(dirname(info.path), { recursive: true })
    await git(info.main, ['worktree', 'add', '-b', branch, info.path, info.base], { timeout: 180_000, env: NO_PROMPT })
    await copyEnvFiles(info.main, info.path)
    updateWorktree(info.path, { pending: false })
  } catch (err) {
    preparing.delete(info.path)
    const stderr = (err as { stderr?: string }).stderr?.trim()
    failures.set(info.path, tr(`Não consegui criar a tarefa: ${stderr || errorMessage(err)}`, `Couldn’t create the task: ${stderr || errorMessage(err)}`))
    return
  }
  // A conversa já pode começar; as dependências chegam em seguida.
  void install(info.path)
    // Sem conseguir nem começar (o WSL sem responder ao preparar o comando): o card mostra também.
    .catch((err: unknown) => errorMessage(err))
    .then((err) => {
      if (err) failures.set(info.path, tr(`Dependências não instaladas: ${err}`, `Dependencies not installed: ${err}`))
    })
    .finally(() => preparing.delete(info.path))
}

// Os .env que o git ignora, em qualquer pasta. --directory resume as pastas ignoradas inteiras
// (node_modules/, dist/) numa linha só, em vez de listar cada arquivo delas.
async function listEnvFiles(root: string): Promise<string[]> {
  const out = await git(root, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory'], {
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024
  })
  return out.split('\0').filter((p) => p && !p.endsWith('/') && ENV_FILE.test(basename(p)))
}

async function copyEnvFiles(from: string, to: string): Promise<void> {
  const files = await listEnvFiles(from).catch(() => [])
  for (const file of files) {
    const target = join(to, file)
    if (await exists(target)) continue
    try {
      await mkdir(dirname(target), { recursive: true })
      await copyFile(join(from, file), target)
    } catch {
      // um .env que não deu para copiar não impede a tarefa
    }
  }
}

// Instala as dependências na pasta nova (pnpm install num monorepo pnpm). Sem package.json, nada.
// Devolve nulo se deu certo, ou o erro.
async function install(root: string): Promise<string | null> {
  const pkgFile = join(root, 'package.json')
  if (!(await exists(pkgFile))) return null
  let declared: unknown
  try {
    declared = (JSON.parse(await readFile(pkgFile, 'utf8')) as { packageManager?: unknown }).packageManager
  } catch {
    declared = undefined
  }
  return runInFolder(root, `${await packageManager(root, declared)} install`, 15 * 60_000)
}
