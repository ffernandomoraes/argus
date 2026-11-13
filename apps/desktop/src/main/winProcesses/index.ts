// Processos no Windows, no lugar do `ps`, do `lsof` e dos grupos de processo do Mac. Só é usado
// quando o app roda no Windows (o `powershell` também serve à área de transferência e ao PATH).
export { powershell } from './powershell'
export { processTable } from './processTable'
export { ancestors, childrenOf, type WinProcess } from './processTree'
export { listeningPorts } from './ports'
export { killTree, killTreeSync } from './kill'
