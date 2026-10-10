import { app } from 'electron'
import { receiveFolders } from './app/folderOpener'
import { setupLifecycle } from './app/lifecycle'
import { createServices } from './app/services'
import { startApp } from './app/startup'
import { openArg } from './cli'
import { IS_MAC, IS_WIN } from './platform'

// Partida do processo principal. As peças ficam em app/ (janelas, serviços, saída, segurança) e
// ipc/ (os canais da janela, tipados por src/shared/ipc.ts).

// O pnpm dev tem dados próprios: com a mesma pasta do instalado, um sobrescreveria o canvas e as
// configurações do outro.
if (!app.isPackaged) app.setPath('userData', `${app.getPath('userData')} Dev`)

// Uma instância só: com duas, as duas gravariam o mesmo canvas.json e a segunda tomaria o socket do
// `argus` (ver o módulo cli) da primeira. A segunda entrega à primeira a pasta do `argus .`
// (Windows) ou só a traz para frente (Mac, aberta com `open -n`) e sai.
// No pnpm dev do Mac fica sem a trava, como antes: o --watch do electron-vite abre o app novo sem
// esperar o anterior fechar, e o novo sairia na hora, levando o pnpm dev junto.
function firstInstance(): boolean {
  if (IS_MAC && !app.isPackaged) return true
  return app.requestSingleInstanceLock({ open: openArg(process.argv) })
}

if (!firstInstance()) app.exit(0)
else start()

function start(): void {
  // Windows: identifica o app nas notificações, com o mesmo id do atalho que o instalador cria.
  if (IS_WIN) app.setAppUserModelId(app.isPackaged ? 'dev.argus.app' : process.execPath)
  const services = createServices()
  receiveFolders()
  const life = setupLifecycle(services)
  app
    .whenReady()
    .then(() => startApp(services, life))
    .catch((err: unknown) => console.error('[app] a abertura falhou:', err))
}
