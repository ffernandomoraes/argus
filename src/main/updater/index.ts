import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { access, constants, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { UpdateState } from '../../shared/updates'
import { errorMessage } from '../lib/errors'
import { IS_WIN } from '../platform'
import { downloadTo } from './download'
import { cleanupDownloads, newDownloadDir, removePath } from './files'
import { fetchLatestRelease, fetchRecentReleases } from './github'
import { currentBundle, extractApp, hasExecutable, spawnSwap, verifyApp } from './mac'
import { isMacAsset, isNewer, isWindowsAsset, newestWith, releaseVersion, type Release, type ReleaseAsset } from './releases'
import { installedByInstaller, spawnInstaller } from './windows'

// Atualização pelos releases do GitHub, sem o Squirrel (electron-updater): o app é assinado com
// certificado próprio, não com o da Apple. No Mac, baixa o .zip, confere se a assinatura é a mesma
// do app instalado e troca o .app depois que o processo sai (mac.ts). No Windows, baixa o
// instalador da versão nova e roda ele em modo silencioso quando o app fecha (windows.ts).

const FIRST_CHECK_MS = 10_000
const EVERY_MS = 5 * 60 * 60_000

// app: o .app novo (Mac) ou o instalador baixado (Windows); dir: a pasta do download.
type Ready = { app: string; dir: string }

export class Updater {
  state: UpdateState
  private ready: Ready | null = null
  private busy = false
  private installing = false
  private timer: NodeJS.Timeout | null = null
  // Limpeza das sobras da abertura: a conferência espera ela, para nunca apagar o próprio download.
  private cleaning: Promise<void> = Promise.resolve()

  constructor(private onChange: (state: UpdateState) => void) {
    this.state = this.support()
  }

  private support(): UpdateState {
    if (!app.isPackaged) return { status: 'unsupported', reason: 'Em desenvolvimento o app não se atualiza.' }
    if (IS_WIN) {
      if (!installedByInstaller()) {
        return { status: 'unsupported', reason: 'Instale o Argus pelo instalador para receber atualizações.' }
      }
      return { status: 'idle' }
    }
    const bundle = currentBundle()
    // Aberto direto do .dmg, ou ainda em quarentena (o macOS roda uma cópia temporária).
    if (!bundle || bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/')) {
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
    this.cleaning = cleanupDownloads()
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
      await this.cleaning
      const latest = await fetchLatestRelease()
      const version = latest ? releaseVersion(latest) : ''
      if (!latest || !version || !isNewer(version, app.getVersion())) {
        this.set({ status: 'latest' })
      } else if (IS_WIN) {
        await this.updateWindows(latest, version)
      } else {
        const asset = latest.assets.find(isMacAsset)
        if (!asset) throw new Error('A versão nova não tem o arquivo do app para Mac.')
        await this.downloadMac(version, asset, latest.html_url)
      }
    } catch (err) {
      this.set({ status: 'error', message: errorMessage(err) })
    } finally {
      this.busy = false
    }
    return this.state
  }

  // O instalador do Windows sobe para o release alguns minutos depois do app do Mac, e falta de vez
  // se a montagem do Windows falhar. Sem ele no mais novo, vale o release mais recente que tem.
  // Nenhum mais novo que a versão em uso: avisa, em vez de dizer que já está na mais recente.
  private async updateWindows(latest: Release, version: string): Promise<void> {
    const current = app.getVersion()
    const pick =
      newestWith([latest], current, isWindowsAsset) ?? newestWith(await fetchRecentReleases(), current, isWindowsAsset)
    if (pick) return this.downloadWindows(pick.version, pick.asset, pick.release.html_url)
    this.set({
      status: 'waiting',
      version,
      message: `A versão ${version} ainda não tem o instalador do Windows (ele sai alguns minutos depois). Procure de novo daqui a pouco.`
    })
  }

  // Baixa mostrando o progresso na barra de título.
  private fetchTo(version: string, url: string, file: string): Promise<void> {
    this.set({ status: 'downloading', version, progress: 0 })
    return downloadTo(url, file, version, (progress) => this.set({ status: 'downloading', version, progress }))
  }

  private async downloadMac(version: string, asset: ReleaseAsset, notesUrl: string): Promise<void> {
    const target = currentBundle()
    if (!target) throw new Error('O app em uso não está num .app.')
    try {
      await access(dirname(target), constants.W_OK)
      await access(target, constants.W_OK)
    } catch {
      throw new Error(`Sem permissão para trocar o app em ${dirname(target)}.`)
    }

    const dir = await newDownloadDir()
    try {
      const zip = join(dir, 'update.zip')
      await this.fetchTo(version, asset.browser_download_url, zip)
      const next = await extractApp(zip, dir)
      await removePath(zip)
      await verifyApp(next, target)
      this.ready = { app: next, dir }
      this.set({ status: 'ready', version, notesUrl })
    } catch (err) {
      await removePath(dir)
      throw err
    }
  }

  // Windows: sem assinatura para conferir (o app não tem certificado), confere ao menos que o
  // instalador chegou inteiro, pelo tamanho que o GitHub informa.
  private async downloadWindows(version: string, asset: ReleaseAsset, notesUrl: string): Promise<void> {
    const dir = await newDownloadDir()
    try {
      const installer = join(dir, asset.name)
      await this.fetchTo(version, asset.browser_download_url, installer)
      if (asset.size && (await stat(installer)).size !== asset.size) {
        throw new Error(`O download da versão ${version} chegou incompleto.`)
      }
      this.ready = { app: installer, dir }
      this.set({ status: 'ready', version, notesUrl })
    } catch (err) {
      await removePath(dir)
      throw err
    }
  }

  // relaunch: reinicia agora. Sem ele (app fechando), a versão nova entra na próxima abertura.
  // Devolve false quando não deu nem para começar (o app então não fecha).
  install(relaunch: boolean): boolean {
    return this.launch(relaunch) !== null
  }

  // Igual ao install, mas responde só quando o programa da troca (Mac) ou o instalador (Windows)
  // abriu de fato: true se abriu, false se não (ex.: instalador apagado por um antivírus). Para quem
  // precisa do resultado antes de seguir (o "Reiniciar e atualizar", em app/quitFlow.ts).
  installAsync(relaunch: boolean): Promise<boolean> {
    return this.launch(relaunch) ?? Promise.resolve(false)
  }

  // O app só fecha depois que o programa abriu de fato; se ele não abrir, o erro aparece na barra
  // de título e o app segue aberto.
  private launch(relaunch: boolean): Promise<boolean> | null {
    const ready = this.ready
    if (!ready || this.installing) return null
    const failed = (reason: string) => {
      this.installing = false
      this.ready = null
      void removePath(ready.dir)
      const what = IS_WIN ? 'abrir o instalador da versão nova' : 'instalar a versão nova'
      this.set({ status: 'error', message: `Não deu para ${what} (${reason}).` })
    }
    let child: ChildProcess
    if (IS_WIN) {
      if (!existsSync(ready.app)) {
        failed('o arquivo baixado sumiu')
        return null
      }
      child = spawnInstaller(ready.app, relaunch)
    } else {
      const target = currentBundle()
      if (!target || !hasExecutable(ready.app)) {
        failed('a versão baixada está incompleta')
        return null
      }
      child = spawnSwap(ready.app, target, ready.dir, relaunch)
    }
    this.installing = true
    return new Promise((resolve) => {
      child.once('error', (err) => {
        failed(err.message)
        resolve(false)
      })
      child.once('spawn', () => {
        child.unref()
        if (relaunch) app.quit()
        resolve(true)
      })
    })
  }
}
