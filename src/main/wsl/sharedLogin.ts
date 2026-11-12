import { homedir } from 'node:os'
import { join, relative } from 'node:path'
import { accountDir } from '../accounts/paths'
import { loadAppSettings } from '../appSettings'
import { accountIds } from '../accounts/registry'
import { emailFrom } from '../auth/parseStatus'
import { readJsonFileAsync, writeJsonAtomic } from '../lib/jsonFile'
import { distroInfo, loadDistro, type DistroInfo } from './distros'
import { distroFor } from './index'
import { wslAccountDir } from './accounts'
import { log } from './log'
import { parseWslPath, sameDistro, toUnc } from './path'

// Um login só por conta, no Windows e no WSL (Argus no Windows com o claude.exe e pastas no WSL).
// Até a 0.1.124, a conversa de uma pasta do WSL usava um login guardado dentro do Linux, separado
// do do Windows: cada conta precisava entrar duas vezes, e as duas podiam acabar sendo contas
// diferentes do Claude (relato de 2026-11-12: "selecionado na minha conta, gastando a de outro";
// remover a outra conta não mudava nada). Agora o `claude` do Linux recebe em
// CLAUDE_SECURESTORAGE_CONFIG_DIR a pasta da conta no Windows, vista de dentro da distro
// (/mnt/c/Users/ana/.claude): é a variável do Claude Code para o lugar do login, separada da pasta
// de configuração (conferido no binário da 2.1.322: o .credentials.json é lido e gravado nela, e a
// trava da renovação fica nela também, a mesma para os processos do Windows e do Linux). As
// configurações e o histórico seguem na pasta do Linux, como antes; só o login passa a ser um só.
// Entrar, trocar e sair de uma conta pelo app valem nos dois lugares.
//
// Vale quando o `claude` do app é o do Windows, os discos do Windows estão montados na distro
// (DistroInfo.winHome) e o Windows guarda o login em arquivo. Senão, fica o login separado de
// antes, com a linha "WSL (distro)" no cartão da conta (ver auth/wslPlace.ts). Também dá para
// desligar nas Configurações (Geral > Linux (WSL)): feito sem um Windows com WSL para testar, a
// saída para quem tiver problema não pode depender de uma versão nova.

// O Claude Code do Windows pode guardar o login no cofre de credenciais do Windows em vez do
// arquivo (em teste, atrás de uma opção do servidor; conferido na 2.1.322): aí não há arquivo para
// o Linux ler. Conferido na abertura (ver checkWindowsStore).
let loginInFile = true
// A opção das Configurações (AppSettings.wslSharedLogin); lida do arquivo uma vez.
let enabled: boolean | null = null
const isEnabled = (): boolean => (enabled ??= loadAppSettings().wslSharedLogin !== false)

export function setSharedLoginEnabled(on: boolean): void {
  enabled = on
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

// Pasta de configuração da conta no Windows: a dela, ou o ~/.claude na principal.
const windowsConfigDir = (account: string) => accountDir(account) ?? join(homedir(), '.claude')
// O .claude.json da conta no Windows: o da principal fica na pasta do usuário.
const windowsConfigFile = (account: string) => join(accountDir(account) ?? homedir(), '.claude.json')

// Na abertura: alguma conta com o login no cofre do Windows? A mesma pergunta que o Claude Code faz
// (a opção fica no .claude.json da conta).
export async function checkWindowsStore(): Promise<void> {
  if (process.env.CLAUDE_CODE_FORCE_WINDOWS_CREDMAN === '1') {
    loginInFile = false
    return
  }
  const reads = await Promise.all(accountIds().map((id) => readJsonFileAsync(windowsConfigFile(id))))
  const vault = reads.some((r) => r.status === 'ok' && isObject(r.data) && isObject(r.data.cachedGrowthBookFeatures) && r.data.cachedGrowthBookFeatures.tengu_windows_credman === true)
  if (vault && loginInFile) log('login compartilhado com o WSL desligado: o Claude Code do Windows guarda o login no cofre de credenciais')
  loginInFile = !vault
}

// A pasta do usuário do Windows vista de dentro da distro, se o login das contas é compartilhado
// com ela; nulo se o login de lá é separado.
export function sharedLoginHome(distro: string): string | null {
  // Sem o claude.exe, o `claude` do app já roda numa distro: o login dele é o de lá.
  if (distroFor() || !loginInFile || !isEnabled()) return null
  return distroInfo(distro)?.winHome ?? null
}

// O que o app sabe da distro foi guardado por uma versão anterior, sem a pasta do Windows: pergunta
// de novo antes de decidir. Sem isso, a primeira conversa depois de atualizar o app abria com o login
// separado de antes.
export async function sharedLoginReady(distro: string): Promise<void> {
  if (distroInfo(distro)?.winHome === undefined) await loadDistro(distro)
}

// Por que o login não é compartilhado com a distro, para o diagnóstico; nulo se é.
export function sharedLoginBlocker(distro: string): 'own' | 'off' | 'vault' | 'unmounted' | 'unknown' | null {
  if (distroFor()) return 'own'
  if (!isEnabled()) return 'off'
  if (!loginInFile) return 'vault'
  const winHome = distroInfo(distro)?.winHome
  return winHome ? null : winHome === null ? 'unmounted' : 'unknown'
}

// Onde o `claude` daquela distro acha o login da conta: a pasta dela no Windows, no caminho do
// Linux. Nulo: login separado.
export function sharedLoginDir(distro: string, account: string): string | null {
  const home = sharedLoginHome(distro)
  if (!home) return null
  const rest = relative(homedir(), windowsConfigDir(account)).split(/[\\/]+/).filter(Boolean)
  // Pasta da conta fora da pasta do usuário (não acontece hoje): sem caminho certo lá dentro.
  if (rest[0] === '..' || /^[a-zA-Z]:$/.test(rest[0] ?? '')) return null
  return [home.replace(/\/+$/, ''), ...rest].join('/')
}

// A conversa desta pasta roda com o mesmo login do `claude` do app (o que a barra de uso lê)? Com o
// `claude.exe` no Windows e o login separado, a de uma pasta do WSL usa o login de lá, que pode ser
// de outra conta do Claude: os limites que ela informa não são os da conta que o app mostra (relato
// de 2026-11-12: a barra trocava o semanal de uma conta pelo de outra a cada resposta).
export function sharesAppLogin(cwd: string): boolean {
  const own = distroFor()
  const distro = distroFor(cwd)
  if (own && distro) return sameDistro(own, distro)
  if (own === distro) return true
  // Pasta do WSL com o `claude` do app no Windows: só com o login compartilhado.
  return !!distro && !!parseWslPath(cwd) && !!sharedLoginHome(distro)
}

// O .claude.json da conta no Linux guarda de quem era o último login usado lá (oauthAccount: e-mail,
// organização), e o Claude Code só confere de novo um dia depois. Vindo do login separado de antes
// (ou do `claude` do terminal de lá, na principal), pode ser de outra conta: com o login agora
// compartilhado, a conversa gastaria o limite da conta certa dizendo ser a outra. Quando o e-mail de
// lá não é o da conta no Windows, o bloco sai, e o Claude Code o preenche de novo pelo login em uso.
// Uma vez por conta, distro e e-mail em cada abertura do app; nada disso segura a conversa.
const aligned = new Set<string>()

export async function alignWslIdentity(distro: string, info: DistroInfo, account: string): Promise<void> {
  try {
    const app = await readJsonFileAsync(windowsConfigFile(account))
    const email = app.status === 'ok' ? emailFrom(app.data) : undefined
    if (!email) return
    const key = `${distro.toLowerCase()}\0${account}\0${email.toLowerCase()}`
    if (aligned.has(key)) return
    aligned.add(key)
    const file = toUnc(distro, `${wslAccountDir(info, account) ?? info.home}/.claude.json`)
    const there = await readJsonFileAsync(file)
    if (there.status !== 'ok' || !isObject(there.data)) return
    const other = emailFrom(there.data)
    if (!other || other.toLowerCase() === email.toLowerCase()) return
    const { oauthAccount: _stale, ...rest } = there.data
    await writeJsonAtomic(file, rest, { indent: 2, mode: 0o600 })
    log(`conta ${account} no WSL (${distro}): os dados do login anterior saíram do .claude.json de lá`)
  } catch (err) {
    log(`conta ${account} no WSL (${distro}): não deu para conferir o .claude.json de lá`, (err as Error).message)
  }
}
