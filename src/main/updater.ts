import { execFile, spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { access, constants, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { promisify } from 'node:util'
import { app, net } from 'electron'
import type { UpdateState } from '../shared/updates'
import { IS_WIN } from './platform'

// Atualização pelos releases do GitHub, sem o Squirrel (electron-updater): o app é assinado com
// certificado próprio, não com o da Apple. No Mac, baixa o .zip, confere se a assinatura é a mesma
// do app instalado e troca o .app depois que o processo sai. No Windows, baixa o instalador da
// versão nova e roda ele em modo silencioso quando o app fecha: ele termina de fechar o que sobrou
// do app, troca os arquivos e, se pedido, abre o Argus de novo.

const run = promisify(execFile)
const REPO = 'ffernandomoraes/argus'
const FIRST_CHECK_MS = 10_000
const EVERY_MS = 5 * 60 * 60_000
const TEMP_PREFIX = 'argus-update-'
// Onde o download espera a hora de instalar: a pasta temporária no Mac; no Windows, a pasta de
// dados do app, porque a limpeza automática do Windows apaga o que fica dias na temporária.
const downloadsDir = () => (IS_WIN ? join(app.getPath('userData'), 'updates') : tmpdir())
// Instalador do Windows publicado em cada release (ver electron-builder.yml).
const WINDOWS_ASSET = /^Argus-Setup-[\d.]+\.exe$/
// O instalador cria este desinstalador na pasta do app; sem ele, o app não foi instalado por ele.
const WINDOWS_UNINSTALLER = 'Uninstall Argus.exe'

type Release = {
  tag_name: string
  html_url: string
  assets: { name: string; size: number; browser_download_url: string }[]
}

// "0.10.0" > "0.9.3": compara número a número, não como texto.
function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

// Requisito de assinatura (designated requirement). Com o mesmo certificado, ele é igual em todas
// as versões; é por ele que o macOS reconhece o app e mantém as permissões.
async function requirement(path: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await run('codesign', ['-d', '-r-', path])
    return `${stdout}\n${stderr}`.split('\n').find((l) => l.includes('designated =>'))?.trim() ?? null
  } catch {
    return null
  }
}

// No Mac, pelo `rm` do sistema: no Electron, o fs enxerga o app.asar como pasta e o rm recursivo
// falha. No Windows a pasta só tem o instalador baixado.
const remove = (path: string) =>
  IS_WIN ? rm(path, { recursive: true, force: true }).catch(() => {}) : run('rm', ['-rf', path]).catch(() => {})

// Roda solto, depois que o app fecha: espera o processo sair, troca o .app e, se pedido, reabre.
// Se a troca falhar no meio, devolve o app antigo.
const INSTALL_SCRIPT = `
pid="$1"; next="$2"; target="$3"; relaunch="$4"; dir="$5"
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
if mv "$target" "$target.old"; then
  if mv "$next" "$target"; then rm -rf "$target.old"; else mv "$target.old" "$target"; fi
fi
xattr -dr com.apple.quarantine "$target" 2>/dev/null
rm -rf "$dir"
[ "$relaunch" = 1 ] && open "$target"
`

export class Updater {
  state: UpdateState
  // app: o .app novo (Mac) ou o instalador baixado (Windows).
  private ready: { app: string; dir: string } | null = null
  private busy = false
  private installing = false
  private timer: NodeJS.Timeout | null = null

  constructor(private onChange: (state: UpdateState) => void) {
    this.state = this.support()
  }

  // O .app em uso. Em desenvolvimento não há .app para trocar.
  private bundle(): string {
    return process.execPath.replace(/\.app\/.*$/, '.app')
  }

  private support(): UpdateState {
    if (!app.isPackaged) return { status: 'unsupported', reason: 'Em desenvolvimento o app não se atualiza.' }
    if (IS_WIN) {
      // Rodando de uma pasta copiada, o instalador instalaria outra cópia em vez de atualizar esta.
      if (!existsSync(join(dirname(process.execPath), WINDOWS_UNINSTALLER))) {
        return { status: 'unsupported', reason: 'Instale o Argus pelo instalador para receber atualizações.' }
      }
      return { status: 'idle' }
    }
    const bundle = this.bundle()
    // Aberto direto do .dmg, ou ainda em quarentena (o macOS roda uma cópia temporária).
    if (bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/')) {
      return { status: 'unsupported', reason: 'Mova o Argus para a pasta Aplicativos para receber atualizações.' }
    }
    return { status: 'idle' }
  }

  private set(state: UpdateState): void {
    this.state = state
    this.onChange(state)
  }

  get pending(): boolean {
    return this.ready !== null
  }

  start(): void {
    if (this.state.status === 'unsupported') return
    if (IS_WIN) void this.cleanup()
    setTimeout(() => void this.check(), FIRST_CHECK_MS)
    this.timer = setInterval(() => void this.check(), EVERY_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async check(): Promise<UpdateState> {
    if (this.state.status === 'unsupported' || this.busy || this.ready) return this.state
    this.busy = true
    this.set({ status: 'checking' })
    try {
      const release = await this.latest()
      const version = release?.tag_name.replace(/^v/, '')
      if (!release || !version || !isNewer(version, app.getVersion())) {
        this.set({ status: 'latest' })
      } else if (IS_WIN) {
        // O instalador do Windows sobe para o release alguns minutos depois do app do Mac: sem ele
        // ainda, fica para a próxima conferência.
        const asset = release.assets.find((a) => WINDOWS_ASSET.test(a.name))
        if (!asset) this.set({ status: 'latest' })
        else await this.downloadInstaller(version, asset, release.html_url)
      } else {
        const asset = release.assets.find((a) => a.name.endsWith('-arm64.zip'))
        if (!asset) throw new Error('A versão nova não tem o arquivo do app para Mac.')
        await this.download(version, asset.browser_download_url, release.html_url)
      }
    } catch (err) {
      this.set({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      this.busy = false
    }
    return this.state
  }

  private async latest(): Promise<Release | null> {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    // Nenhum release publicado ainda.
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`O GitHub respondeu ${res.status} ao procurar a versão nova.`)
    return (await res.json()) as Release
  }

  // Baixa o arquivo mostrando o progresso na barra de título.
  private async fetchTo(version: string, url: string, file: string): Promise<void> {
    this.set({ status: 'downloading', version, progress: 0 })
    const res = await net.fetch(url)
    if (!res.ok || !res.body) throw new Error(`O download da versão ${version} falhou (${res.status}).`)
    const total = Number(res.headers.get('content-length')) || 0
    const report = (progress: number) => this.set({ status: 'downloading', version, progress })
    async function* track(source: AsyncIterable<Buffer>) {
      let received = 0
      let shown = 0
      for await (const chunk of source) {
        received += chunk.length
        const progress = total ? received / total : 0
        // De 2 em 2%: não inunda a janela com mensagens.
        if (progress - shown >= 0.02) {
          shown = progress
          report(progress)
        }
        yield chunk
      }
    }
    await pipeline(Readable.fromWeb(res.body as ReadableStream<Uint8Array>), track, createWriteStream(file))
  }

  private async download(version: string, url: string, notesUrl: string): Promise<void> {
    const target = this.bundle()
    try {
      await access(dirname(target), constants.W_OK)
      await access(target, constants.W_OK)
    } catch {
      throw new Error(`Sem permissão para trocar o app em ${dirname(target)}.`)
    }

    const dir = await mkdtemp(join(tmpdir(), TEMP_PREFIX))
    try {
      const zip = join(dir, 'update.zip')
      await this.fetchTo(version, url, zip)
      await run('ditto', ['-x', '-k', zip, dir])
      await remove(zip)

      const next = join(dir, basename(target))
      await this.verify(next)
      this.ready = { app: next, dir }
      this.set({ status: 'ready', version, notesUrl })
    } catch (err) {
      await remove(dir)
      throw err
    }
  }

  // Windows: sem assinatura para conferir (o app não tem certificado), confere ao menos que o
  // instalador chegou inteiro, pelo tamanho que o GitHub informa.
  private async downloadInstaller(version: string, asset: Release['assets'][number], notesUrl: string): Promise<void> {
    await mkdir(downloadsDir(), { recursive: true })
    const dir = await mkdtemp(join(downloadsDir(), TEMP_PREFIX))
    try {
      const installer = join(dir, asset.name)
      await this.fetchTo(version, asset.browser_download_url, installer)
      if (asset.size && (await stat(installer)).size !== asset.size) {
        throw new Error(`O download da versão ${version} chegou incompleto.`)
      }
      this.ready = { app: installer, dir }
      this.set({ status: 'ready', version, notesUrl })
    } catch (err) {
      await remove(dir)
      throw err
    }
  }

  // Windows: o instalador de uma atualização anterior fica para trás (estava rodando quando o app
  // fechou). Sai na abertura seguinte.
  private async cleanup(): Promise<void> {
    try {
      for (const name of await readdir(downloadsDir())) {
        if (name.startsWith(TEMP_PREFIX)) await remove(join(downloadsDir(), name))
      }
    } catch {
      // Pasta ainda não existe, ou sem acesso: fica para a próxima.
    }
  }

  private async verify(next: string): Promise<void> {
    try {
      await run('codesign', ['--verify', '--deep', '--strict', next])
    } catch {
      throw new Error('A versão baixada não passou na conferência de assinatura.')
    }
    const [current, downloaded] = await Promise.all([requirement(this.bundle()), requirement(next)])
    if (!current || current !== downloaded) throw new Error('A versão baixada foi assinada por outro certificado.')
  }

  // relaunch: reinicia agora. Sem ele (app fechando), a versão nova entra na próxima abertura.
  // Devolve false quando não deu para começar (o app então não fecha).
  install(relaunch: boolean): boolean {
    if (!this.ready || this.installing) return false
    if (IS_WIN) return this.runInstaller(this.ready, relaunch)
    this.installing = true
    const args = [String(process.pid), this.ready.app, this.bundle(), relaunch ? '1' : '0', this.ready.dir]
    spawn('/bin/sh', ['-c', INSTALL_SCRIPT, 'argus-update', ...args], { detached: true, stdio: 'ignore' }).unref()
    if (relaunch) app.quit()
    return true
  }

  // Windows: /S, sem telas. --updated: é atualização (fecha o que sobrar do app aberto e mantém os
  // atalhos como estão). --force-run: abre o app no fim. O app só fecha depois que o instalador
  // abriu de fato; se ele não abrir (apagado por um antivírus, por exemplo), o erro aparece na
  // barra de título e o app segue aberto.
  private runInstaller(ready: { app: string; dir: string }, relaunch: boolean): boolean {
    const failed = (reason: string) => {
      this.installing = false
      this.ready = null
      void remove(ready.dir)
      this.set({ status: 'error', message: `Não deu para abrir o instalador da versão nova (${reason}).` })
    }
    if (!existsSync(ready.app)) {
      failed('o arquivo baixado sumiu')
      return false
    }
    this.installing = true
    const child = spawn(ready.app, ['/S', '--updated', ...(relaunch ? ['--force-run'] : [])], { detached: true, stdio: 'ignore' })
    child.once('error', (err) => failed(err.message))
    child.once('spawn', () => {
      child.unref()
      if (relaunch) app.quit()
    })
    return true
  }
}
