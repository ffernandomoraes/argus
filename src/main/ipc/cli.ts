import { canvasMounted } from '../app/folderOpener'
import { cliStatus, installCli, uninstallCli } from '../cli'
import { handle, on } from './register'

// Comando `argus` do terminal: instalar no PATH e receber as pastas que ele manda abrir.
export function registerCliIpc(): void {
  // O canvas montou: passa a receber as pastas do `argus .`.
  on('cli:ready', (e) => canvasMounted(e.sender))
  handle('cli:status', () => cliStatus())
  handle('cli:install', () => installCli())
  handle('cli:uninstall', () => uninstallCli())
}
