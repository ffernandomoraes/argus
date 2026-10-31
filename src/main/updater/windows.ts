import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Atualização no Windows: baixa o instalador da versão nova e roda ele em modo silencioso no
// "Reiniciar e atualizar": ele termina de fechar o que sobrou do app, troca os arquivos e abre o
// Argus de novo. Fechar o app não instala (ver shutdown.ts).

// O instalador cria este desinstalador na pasta do app; sem ele, o app não foi instalado por ele
// (rodando de uma pasta copiada, o instalador instalaria outra cópia em vez de atualizar esta).
export function installedByInstaller(): boolean {
  return existsSync(join(dirname(process.execPath), 'Uninstall Argus.exe'))
}

// Linha do cmd que roda o instalador e confere o resultado. O instalador desinstala a versão antiga
// antes de copiar a nova e, se a cópia falhar (antivírus segurando ou apagando o Argus.exe recém-
// copiado), termina sem o app: a pasta fica sem o executável. Sem ele no fim, roda o instalador mais
// uma vez. /S, sem telas. --updated: é atualização (fecha o que sobrar do app aberto e mantém os
// atalhos como estão). --force-run: abre o app no fim. O start /wait espera o instalador sair (o cmd
// não espera programa com janela).
export function installerCommand(installer: string, exe: string, relaunch: boolean): string {
  const run = `start "" /wait "${installer}" /S --updated${relaunch ? ' --force-run' : ''}`
  return `${run} & if not exist "${exe}" ${run}`
}

// Roda pelo cmd, sem janela de console, solto do app (que sai logo em seguida).
export function spawnInstaller(installer: string, relaunch: boolean): ChildProcess {
  const line = installerCommand(installer, process.execPath, relaunch)
  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    // O Node escaparia as aspas com barra invertida, que o cmd não entende.
    windowsVerbatimArguments: true
  })
}
