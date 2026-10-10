// Comando `argus`, o `code .` deste app: em qualquer terminal, `argus .` abre a pasta no canvas.
// No Mac, o script manda o caminho por um socket local; o app escuta enquanto está aberto. No
// Windows, o argus.cmd abre o Argus.exe com a pasta, e o app já aberto recebe dele o pedido (o
// Windows deixa uma instância só, ver src/main/index.ts).
export { CLI_BIN } from './locations'
export { openArg, validFolder } from './openArg'
export { Cli } from './server'
export { cliStatus, installCli, uninstallCli } from './install'
