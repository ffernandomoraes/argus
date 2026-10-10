import { app, dialog } from 'electron'
import type { Updater } from '../updater'

// "Procurar atualizações…" do menu: diferente da conferência automática, sempre responde.
export async function checkForUpdates(updater: Updater, restartToUpdate: () => Promise<void>): Promise<void> {
  const state = await updater.check()
  const current = app.getVersion()
  if (state.status === 'ready') {
    const { response } = await dialog.showMessageBox({
      message: `A versão ${state.version} está pronta.`,
      detail: `Você está na ${current}. O Argus reinicia para atualizar.`,
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 0) await restartToUpdate()
    return
  }
  const message =
    state.status === 'latest' ? 'Você já está na versão mais recente.'
    : state.status === 'downloading' ? `Baixando a versão ${state.version}.`
    : state.status === 'unsupported' ? state.reason
    : state.status === 'error' ? 'Não deu para procurar atualizações.'
    : state.status === 'waiting' ? `A versão ${state.version} ainda não está pronta para o Windows.`
    : 'Procurando atualizações.'
  await dialog.showMessageBox({
    message,
    detail: state.status === 'error' || state.status === 'waiting' ? state.message : `Versão em uso: ${current}.`
  })
}
