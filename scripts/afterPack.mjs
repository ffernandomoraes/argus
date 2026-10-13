// Gancho afterPack do electron-builder: roda depois de montar a pasta do app, antes do instalador.
import sign from './sign.mjs'
import linuxLauncher from './linuxLauncher.mjs'

export default async function afterPack(context) {
  await sign(context)
  await linuxLauncher(context)
}
