import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { MAIN_ACCOUNT } from '../../shared/auth'
import { SHARED } from '../accounts/links'
import { accountDir } from '../accounts/paths'
import { seed } from '../accounts/seed'
import { WSL_EXE, type DistroInfo } from './distros'
import { log } from './log'
import { toLinux, toUnc } from './path'

// Contas do Claude num projeto do WSL. A principal é a do ~/.claude do Linux, a mesma do terminal
// de lá. As outras ganham uma pasta própria no Linux (~/.argus/accounts/<id>), com os mesmos
// links para a principal que o app cria no Mac e no Windows (ver accounts/links.ts), mas para a
// principal do Linux.
// O login é um só para o Windows e o WSL: entrou numa conta, ela vale nos projetos dos dois. O
// `claude` do Linux lê e grava o login na pasta da conta no Windows (/mnt/c/...), pela
// CLAUDE_SECURESTORAGE_CONFIG_DIR, que só muda onde fica o login. A trava que o Claude Code usa ao
// renovar o acesso mora na mesma pasta, então os dois lados se revezam como dois terminais do
// mesmo Windows. Uma cópia do arquivo em cada lado não serviria: cada renovação troca o refresh
// token, e a cópia velha deixaria de valer. Um link para o arquivo do Windows também não: o Claude
// Code grava num arquivo novo e troca pelo antigo, e o link vira uma cópia na primeira renovação
// (conferido na 2.1.292).

const ROOT = app.isPackaged ? '.argus/accounts' : '.argus-dev/accounts'

// Pasta das contas no Linux.
export const wslAccountsRoot = (info: DistroInfo): string => `${info.home}/${ROOT}`

// Pasta da conta no Linux; nada na principal (o `claude` sem a variável usa ~/.claude).
export function wslAccountDir(info: DistroInfo, id: string): string | undefined {
  return id === MAIN_ACCOUNT ? undefined : `${wslAccountsRoot(info)}/${id}`
}

// Pastas de status (<pasta>/sessions) das contas no Linux, vistas pelo Windows.
export function wslStatusDirs(distro: string, info: DistroInfo, ids: string[]): string[] {
  return ids.map((id) => toUnc(distro, `${wslAccountDir(info, id) ?? `${info.home}/.claude`}/sessions`))
}

const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

// Links pelo próprio Linux (ln -s): criados do Windows, pela pasta de rede, não se sabe se viram
// links de verdade lá dentro.
function linkScript(dir: string, main: string): string {
  const lines = SHARED.map(
    (name) => `[ -e ${sq(`${main}/${name}`)} ] && [ ! -e ${sq(`${dir}/${name}`)} ] && [ ! -L ${sq(`${dir}/${name}`)} ] && ln -s ${sq(`${main}/${name}`)} ${sq(`${dir}/${name}`)}`
  )
  return [`mkdir -p ${sq(`${dir}/sessions`)} ${sq(`${main}/projects`)}`, ...lines, 'exit 0', ''].join('\n')
}

const CREDENTIALS = '.credentials.json'

// Pasta do login da conta (CLAUDE_SECURESTORAGE_CONFIG_DIR), no formato do Linux: a da conta no
// Windows. Na principal, o ~/.claude do Windows só quando o Linux não tem login próprio (o do
// terminal de lá, que fica como está); nulo para usar o do Linux.
export function wslLoginDir(distro: string, info: DistroInfo, id: string): string | undefined {
  const dir = accountDir(id)
  if (dir) return toLinux(dir)
  const main = join(homedir(), '.claude')
  if (!existsSync(join(main, CREDENTIALS))) return undefined
  if (existsSync(toUnc(distro, `${info.home}/.claude/${CREDENTIALS}`))) return undefined
  return toLinux(main)
}

// Login feito dentro do WSL quando cada lado tinha o seu (ou com o Claude Code só no WSL): passa
// para a pasta da conta no Windows, de onde os dois lados leem agora. Se o Windows já tem um, vale
// o dele, e o do Linux fica lá sem uso.
function adoptLinuxLogin(distro: string, dir: string, id: string): void {
  const win = accountDir(id)
  if (!win) return
  const target = join(win, CREDENTIALS)
  const source = toUnc(distro, `${dir}/${CREDENTIALS}`)
  try {
    if (existsSync(target) || !existsSync(source)) return
    mkdirSync(win, { recursive: true })
    copyFileSync(source, target)
    rmSync(source, { force: true })
    log(`conta ${id} no WSL (${distro}): login do Linux passou para a pasta do Windows`)
  } catch (err) {
    log(`conta ${id} no WSL (${distro}): não deu para trazer o login do Linux`, (err as Error).message)
  }
}

const ready = new Set<string>()

// Prepara a pasta da conta no Linux antes de cada `claude` dela: cria, copia as configurações da
// principal na primeira vez, traz um login antigo do Linux e liga o que é compartilhado. Uma vez
// por abertura do app.
export async function prepareWslAccount(distro: string, info: DistroInfo, id: string): Promise<void> {
  const dir = wslAccountDir(info, id)
  const key = `${distro}\0${id}`
  if (!dir || ready.has(key)) return
  const unc = toUnc(distro, dir)
  try {
    if (!existsSync(unc)) {
      mkdirSync(unc, { recursive: true })
      seed(unc, toUnc(distro, info.home))
    }
  } catch (err) {
    log(`conta ${id} no WSL (${distro}): não deu para criar a pasta`, (err as Error).message)
  }
  adoptLinuxLogin(distro, dir, id)
  await new Promise<void>((resolve) => {
    const child = spawn(WSL_EXE, ['-d', distro, '--exec', 'sh', '-s'], { windowsHide: true })
    child.on('error', () => resolve())
    child.on('close', () => resolve())
    child.stdin.end(linkScript(dir, `${info.home}/.claude`))
  })
  ready.add(key)
}
