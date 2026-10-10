import { stopStartedServers } from '../projectServers'
import type { Services } from './services'
import { step } from './step'
import { saveCanvasWindowLayout } from './windows'

// Encerra tudo que o app abriu (claude, terminais, ditado, servidores de projeto) para não sobrar
// processo solto, depois de guardar onde as janelas estavam e o canvas pendente.
// install: com uma versão nova já baixada, troca agora, para abrir atualizado da próxima vez. Fica
// de fora no desligamento do Windows (ver lifecycle.ts).
export function shutdown(s: Services, install: boolean): void {
  step('guardar as janelas', saveCanvasWindowLayout)
  step('gravar o canvas', () => s.canvasHub.flush())
  step('monitores de uso', () => s.usage.stop())
  step('login em andamento', () => s.auth.cancel())
  step('ditado', () => s.speech.stop())
  step('ícone da barra de menus', () => s.tray.destroy())
  step('terminais', () => s.terminals.killAll())
  step('servidores de projeto', stopStartedServers)
  step('comando argus', () => s.cli.stop())
  step('conversas', () => s.chats.closeAll())
  step('assistente do canvas', () => s.canvasAgent.close())
  step('vigia das sessões', () => s.sessionWatch.close())
  step('atualizações', () => s.updater.stop())
  if (install) step('instalar a atualização', () => s.updater.install(false))
}
