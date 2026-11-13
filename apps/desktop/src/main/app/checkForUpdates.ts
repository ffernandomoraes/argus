import { app } from 'electron'
import { tr } from '../i18n'
import type { Updater } from '../updater'
import { showMessageBox } from './messageBox'

// A caixa presa à janela não segura o menu: clicar de novo com ela aberta não abre outra.
let open: Promise<void> | null = null

// "Procurar atualizações…" do menu: diferente da conferência automática, sempre responde.
export function checkForUpdates(updater: Updater, restartToUpdate: () => Promise<void>): Promise<void> {
  open ??= checkAndShow(updater, restartToUpdate).finally(() => (open = null))
  return open
}

async function checkAndShow(updater: Updater, restartToUpdate: () => Promise<void>): Promise<void> {
  const state = await updater.check()
  const current = app.getVersion()
  if (state.status === 'ready') {
    const { response } = await showMessageBox({
      message: tr(`A versão ${state.version} está pronta.`, `Version ${state.version} is ready.`),
      detail: tr(
        `Você está na ${current}. O Argus reinicia para atualizar.`,
        `You're on ${current}. Argus will restart to update.`
      ),
      buttons: [tr('Reiniciar agora', 'Restart Now'), tr('Depois', 'Later')],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 0) await restartToUpdate()
    return
  }
  const message =
    state.status === 'latest' ? tr('Você já está na versão mais recente.', "You're on the latest version.")
    : state.status === 'downloading' ? tr(`Baixando a versão ${state.version}.`, `Downloading version ${state.version}.`)
    : state.status === 'unsupported' ? state.reason
    : state.status === 'error' ? tr('Não deu para procurar atualizações.', "Couldn't check for updates.")
    : state.status === 'waiting' ? tr(
          `A versão ${state.version} ainda não está pronta para o Windows.`,
          `Version ${state.version} isn't ready for Windows yet.`
        )
    : tr('Procurando atualizações.', 'Checking for updates.')
  await showMessageBox({
    message,
    detail: state.status === 'error' || state.status === 'waiting' ? state.message : tr(`Versão em uso: ${current}.`, `Current version: ${current}.`)
  })
}
