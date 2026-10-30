import { stopStartedServers } from '../projectServers'
import type { Services } from './services'
import { step } from './step'
import { saveCanvasWindowLayout } from './windows'

// Encerra tudo que o app abriu (claude, terminais, ditado, servidores de projeto) para não sobrar
// processo solto, depois de guardar onde as janelas estavam e o canvas pendente.
// install: com uma versão nova já baixada, troca agora, para abrir atualizado da próxima vez. Fica
// de fora no desligamento do Windows (ver lifecycle.ts).
export function shutdown(s: Services, install: boolean): void {
  // Antes de encerrar as conversas: as que estavam trabalhando ficam marcadas para a próxima abertura.
  step('conversas interrompidas', () => s.interrupted.freeze())
  step('guardar as janelas', saveCanvasWindowLayout)
  step('gravar o canvas', () => s.boards.flush())
  step('monitores de uso', () => s.usage.stop())
  step('login em andamento', () => s.auth.close())
  step('conferência dos agentes', () => s.providers.close())
  step('ditado', () => s.speech.stop())
  step('ícone da barra de menus', () => s.tray.destroy())
  step('terminais', () => s.terminals.killAll())
  step('servidores de projeto', stopStartedServers)
  step('comando argus', () => s.cli.stop())
  step('conversas', () => s.chats.closeAll())
  step('assistente do canvas', () => s.canvasAgent.close())
  step('vigia das sessões', () => s.sessionWatch.close())
  step('atualizações', () => s.updater.stop())
  step('versão do Claude Code', () => s.claudeVersion.stop())
  if (install) step('instalar a atualização', () => s.updater.install(false))
}
