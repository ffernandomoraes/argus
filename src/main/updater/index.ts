import type { ChildProcess } from 'node:child_process'
import { accessSync, chmodSync, copyFileSync, existsSync, renameSync, rmSync } from 'node:fs'
import { access, chmod, constants, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { UpdateState } from '../../shared/updates'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { IS_LINUX, IS_WIN } from '../platform'
import { downloadTo } from './download'
import { cleanupDownloads, newDownloadDir, removePath } from './files'
import { fetchLatestRelease, fetchRecentReleases } from './github'
import { currentBundle, extractApp, hasExecutable, spawnSwap, verifyApp } from './mac'
import { countNewer, isLinuxAsset, isMacAsset, isNewer, isWindowsAsset, newestWith, previousWith, releaseVersion, type Release, type ReleaseAsset } from './releases'
import { skipVersion, updateFloor } from './skipped'
import { installedByInstaller, spawnInstaller } from './windows'

// Atualização pelos releases do GitHub, sem o Squirrel (electron-updater): o app é assinado com
// certificado próprio, não com o da Apple. No Mac, baixa o .zip, confere se a assinatura é a mesma
// do app instalado e troca o .app depois que o processo sai (mac.ts). No Windows, baixa o
// instalador da versão nova e roda ele em modo silencioso quando o app fecha (windows.ts). No Linux,
// baixa o AppImage novo e troca o arquivo no lugar do atual (o Linux deixa trocar com o app aberto:
// a cópia em uso segue lendo o arquivo antigo até sair).

// O AppImage em uso (o arquivo .AppImage, não a cópia montada em /tmp que roda de fato).
const appImage = (): string | null => process.env.APPIMAGE || null

const FIRST_CHECK_MS = 10_000
const EVERY_MS = 5 * 60 * 60_000

// Com esta quantidade de versões publicadas depois da em uso, a atualização vira obrigatória: a
// tela fica coberta até atualizar (RequiredUpdateModal). Só onde a atualização automática funciona.
const REQUIRED_BEHIND = 20

// app: o .app novo (Mac), o instalador baixado (Windows) ou o AppImage novo (Linux); dir: a pasta do
// download.
type Ready = { app: string; dir: string; version: string; notesUrl: string }

export class Updater {
  private current: UpdateState
  private ready: Ready | null = null
  private busy = false
  private installing = false
  // Voltando para a versão anterior (rollback): a conferência automática não baixa outra por cima.
  private rollingBack = false
  private timer: NodeJS.Timeout | null = null
  // Limpeza das sobras da abertura: a conferência espera ela, para nunca apagar o próprio download.
  private cleaning: Promise<void> = Promise.resolve()
  // Atualização obrigatória (ver REQUIRED_BEHIND). Decidida na primeira conferência que consegue
  // falar com o GitHub e mantida até o app fechar; sem internet, nada é decidido nem bloqueado.
  private required = false
  private requiredDecided = false

  constructor(private onChange: (state: UpdateState) => void) {
    this.current = this.support()
  }

  // "Sem suporte" é refeito a cada leitura: o motivo sai no idioma escolhido, mesmo trocado depois.
  get state(): UpdateState {
    return this.current.status === 'unsupported' ? this.support() : this.current
  }

  private support(): UpdateState {
    if (!app.isPackaged) return { status: 'unsupported', reason: tr('Em desenvolvimento o app não se atualiza.', "Development builds don't update.") }
    if (IS_LINUX) {
      const file = appImage()
      if (!file) return { status: 'unsupported', reason: tr('Use o Argus em AppImage para receber atualizações.', 'Run Argus as an AppImage to get updates.') }
      try {
        accessSync(dirname(file), constants.W_OK)
      } catch {
        const dir = dirname(file)
        return {
          status: 'unsupported',
          reason: tr(`Sem permissão para trocar o Argus em ${dir}.`, `No permission to replace Argus in ${dir}.`)
        }
      }
      return { status: 'idle' }
    }
    if (IS_WIN) {
      if (!installedByInstaller()) {
        return { status: 'unsupported', reason: tr('Instale o Argus pelo instalador para receber atualizações.', 'Install Argus with the installer to get updates.') }
      }
      return { status: 'idle' }
    }
    const bundle = currentBundle()
    // Aberto direto do .dmg, ou ainda em quarentena (o macOS roda uma cópia temporária).
    if (!bundle || bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/')) {
      return { status: 'unsupported', reason: tr('Mova o Argus para a pasta Aplicativos para receber atualizações.', 'Move Argus to the Applications folder to get updates.') }
    }
    return { status: 'idle' }
  }

  private set(state: UpdateState): void {
    this.current = state
    this.onChange(state)
  }

  get pending(): boolean {
    return this.ready !== null
  }

  // A troca (ou o instalador) já começou: o app está fechando para entrar a versão baixada.
  get swapping(): boolean {
    return this.installing
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
    if (this.state.status === 'unsupported' || this.busy || this.rollingBack) return this.state
    this.busy = true
    // Já há uma versão baixada (ex.: 0.0.2) e saiu outra mais nova (0.0.10): baixa a mais nova sem
    // mexer na barra de título, e ela substitui a baixada; quem reiniciar no meio leva a que já estava.
    // Se der errado, também fica a que já estava.
    const quiet = this.ready !== null
    if (!quiet) this.set({ status: 'checking' })
    try {
      await this.cleaning
      const floor = this.floor()
      const latest = await fetchLatestRelease()
      const version = latest ? releaseVersion(latest) : ''
      await this.decideRequired(!!latest && !!version && isNewer(version, app.getVersion()))
      if (!latest || !version || !isNewer(version, floor)) {
        if (!quiet) this.set({ status: 'latest' })
      } else if (IS_WIN) {
        await this.updateFrom(latest, version, floor, quiet, isWindowsAsset, () => tr('o instalador do Windows', 'the Windows installer'))
      } else if (IS_LINUX) {
        await this.updateFrom(latest, version, floor, quiet, isLinuxAsset, () => tr('o AppImage do Linux', 'the Linux AppImage'))
      } else {
        const asset = latest.assets.find(isMacAsset)
        if (!asset) throw new Error(tr('A versão nova não tem o arquivo do app para Mac.', "The new version doesn't include the Mac app file."))
        await this.downloadMac(version, asset, latest.html_url, !quiet)
      }
    } catch (err) {
      if (!quiet) this.set({ status: 'error', message: errorMessage(err) })
    } finally {
      this.busy = false
    }
    return this.state
  }

  // Conta os releases mais novos que a versão em uso. Falhar aqui não impede a atualização: fica
  // para decidir na próxima conferência.
  private async decideRequired(hasNewer: boolean): Promise<void> {
    if (this.requiredDecided) return
    if (hasNewer) {
      try {
        this.required = countNewer(await fetchRecentReleases(REQUIRED_BEHIND), app.getVersion()) >= REQUIRED_BEHIND
      } catch {
        return
      }
    }
    this.requiredDecided = true
  }

  // O instalador do Windows e o AppImage do Linux sobem para o release alguns minutos depois do app
  // do Mac, e faltam de vez se a montagem deles falhar. Sem o arquivo no mais novo, vale o release
  // mais recente que tem. Nenhum mais novo que a versão em uso: avisa, em vez de dizer que já está
  // na mais recente.
  private async updateFrom(
    latest: Release,
    version: string,
    floor: string,
    quiet: boolean,
    match: (a: ReleaseAsset) => boolean,
    what: () => string
  ): Promise<void> {
    const pick = newestWith([latest], floor, match) ?? newestWith(await fetchRecentReleases(), floor, match)
    if (pick) return this.downloadFile(pick.version, pick.asset, pick.release.html_url, !quiet)
    if (quiet) return
    this.set({
      status: 'waiting',
      version,
      message: tr(
        `A versão ${version} ainda não tem ${what()} (ele sai alguns minutos depois). Procure de novo daqui a pouco.`,
        `Version ${version} doesn't have ${what()} yet (it comes out a few minutes later). Check again shortly.`
      )
    })
  }

  // Só baixa o que for mais novo que a versão em uso (ou a pulada, ver skipped.ts) e que a já baixada.
  private floor(): string {
    const floor = updateFloor(app.getVersion())
    return this.ready && isNewer(this.ready.version, floor) ? this.ready.version : floor
  }

  // A versão recém-baixada passa a ser a que entra, e a baixada antes dela sai. Se a troca já começou
  // com a anterior, quem sai é a recém-baixada.
  private async accept(next: Ready): Promise<void> {
    if (this.installing) return removePath(next.dir)
    const previous = this.ready
    this.ready = next
    this.set({ status: 'ready', version: next.version, notesUrl: next.notesUrl, required: this.required })
    if (previous) await removePath(previous.dir)
  }

  // Espera a conferência em andamento terminar (ela pode estar baixando uma versão).
  async settled(): Promise<void> {
    while (this.busy) await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // Baixa a versão publicada logo antes da em uso e a deixa pronta, como uma atualização: entra
  // pelo mesmo "Reiniciar e atualizar". A versão em uso fica marcada para pular (ver skipped.ts).
  // Devolve a versão baixada. Para quem está numa versão que quebrou (ver app/crashGuard.ts).
  async rollback(): Promise<string> {
    const support = this.state
    if (support.status === 'unsupported') throw new Error(support.reason)
    this.rollingBack = true
    // Voltar para a anterior não é a atualização obrigatória, e ela não volta nesta sessão.
    this.required = false
    this.requiredDecided = true
    try {
      await this.settled()
      await this.cleaning
      this.busy = true
      // Uma versão mais nova já baixada sai: é dela, ou de uma parecida, que se está fugindo.
      if (this.ready) {
        await removePath(this.ready.dir)
        this.ready = null
      }
      const current = app.getVersion()
      const match = IS_WIN ? isWindowsAsset : IS_LINUX ? isLinuxAsset : isMacAsset
      const pick = previousWith(await fetchRecentReleases(), current, match)
      if (!pick) throw new Error(tr('Não achei uma versão anterior para baixar.', "Couldn't find a previous version to download."))
      if (IS_WIN || IS_LINUX) await this.downloadFile(pick.version, pick.asset, pick.release.html_url)
      else await this.downloadMac(pick.version, pick.asset, pick.release.html_url)
      skipVersion(current)
      return pick.version
    } catch (err) {
      this.set({ status: 'error', message: errorMessage(err) })
      throw err
    } finally {
      this.busy = false
      this.rollingBack = false
    }
  }

  // Baixa mostrando o progresso na barra de título (show) ou em silêncio.
  private fetchTo(version: string, url: string, file: string, show: boolean): Promise<void> {
    if (!show) return downloadTo(url, file, version, () => {})
    const required = this.required
    this.set({ status: 'downloading', version, progress: 0, required })
    return downloadTo(url, file, version, (progress) => this.set({ status: 'downloading', version, progress, required }))
  }

  private async downloadMac(version: string, asset: ReleaseAsset, notesUrl: string, show = true): Promise<void> {
    const target = currentBundle()
    if (!target) throw new Error(tr('O app em uso não está num .app.', "The running app isn't inside a .app."))
    try {
      await access(dirname(target), constants.W_OK)
      await access(target, constants.W_OK)
    } catch {
      const dir = dirname(target)
      throw new Error(tr(`Sem permissão para trocar o app em ${dir}.`, `No permission to replace the app in ${dir}.`))
    }

    const dir = await newDownloadDir()
    try {
      const zip = join(dir, 'update.zip')
      await this.fetchTo(version, asset.browser_download_url, zip, show)
      const next = await extractApp(zip, dir)
      await removePath(zip)
      await verifyApp(next, target)
      await this.accept({ app: next, dir, version, notesUrl })
    } catch (err) {
      await removePath(dir)
      throw err
    }
  }

  // Windows e Linux: sem assinatura para conferir (o app não tem certificado), confere ao menos que
  // o instalador (ou o AppImage) chegou inteiro, pelo tamanho que o GitHub informa.
  private async downloadFile(version: string, asset: ReleaseAsset, notesUrl: string, show = true): Promise<void> {
    const dir = await newDownloadDir()
    try {
      const file = join(dir, asset.name)
      await this.fetchTo(version, asset.browser_download_url, file, show)
      if (asset.size && (await stat(file)).size !== asset.size) {
        throw new Error(tr(`O download da versão ${version} chegou incompleto.`, `The download of version ${version} is incomplete.`))
      }
      if (IS_LINUX) await chmod(file, 0o755)
      await this.accept({ app: file, dir, version, notesUrl })
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
      const message = IS_WIN
        ? tr(`Não deu para abrir o instalador da versão nova (${reason}).`, `Couldn't open the new version's installer (${reason}).`)
        : tr(`Não deu para instalar a versão nova (${reason}).`, `Couldn't install the new version (${reason}).`)
      this.set({ status: 'error', message })
    }
    if (IS_LINUX) return this.swapAppImage(ready, relaunch, failed)
    let child: ChildProcess
    if (IS_WIN) {
      if (!existsSync(ready.app)) {
        failed(tr('o arquivo baixado sumiu', 'the downloaded file is missing'))
        return null
      }
      child = spawnInstaller(ready.app, relaunch)
    } else {
      const target = currentBundle()
      if (!target || !hasExecutable(ready.app)) {
        failed(tr('a versão baixada está incompleta', 'the downloaded version is incomplete'))
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

  // Linux: copia o AppImage novo para o lado do atual e renomeia por cima (a troca é de uma vez: quem
  // abrir o Argus no meio pega o antigo ou o novo, nunca pela metade). O mesmo caminho continua
  // valendo para o atalho do menu e o comando `argus`. relaunch: abre o novo depois que este sai (o
  // relaunch do Electron espera a trava de instância única ser solta).
  private swapAppImage(ready: Ready, relaunch: boolean, failed: (reason: string) => void): Promise<boolean> | null {
    const target = appImage()
    if (!target || !existsSync(ready.app)) {
      failed(tr('a versão baixada sumiu', 'the downloaded version is missing'))
      return null
    }
    this.installing = true
    const temp = `${target}.new`
    try {
      copyFileSync(ready.app, temp)
      chmodSync(temp, 0o755)
      renameSync(temp, target)
    } catch (err) {
      rmSync(temp, { force: true })
      failed(errorMessage(err))
      return null
    }
    this.ready = null
    void removePath(ready.dir)
    if (relaunch) {
      app.relaunch({ execPath: target, args: [] })
      app.quit()
    }
    return Promise.resolve(true)
  }
}
