import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, win32 } from 'node:path';

// Atualização no Windows: baixa o instalador da versão nova e roda ele em modo silencioso no
// "Reiniciar e atualizar": ele termina de fechar o que sobrou do app, troca os arquivos e abre o
// Argus de novo. Fechar o app não instala (ver shutdown.ts).

// O instalador cria este desinstalador na pasta do app.
export function hasUninstaller(): boolean {
  return existsSync(join(dirname(process.execPath), 'Uninstall Argus.exe'));
}

// Pasta onde o instalador (de um clique, por usuário) põe o Argus: %LOCALAPPDATA%\Programs\argus.
export function isStandardInstallDir(dir: string, localAppData: string | undefined): boolean {
  if (!localAppData) return false;
  const norm = (p: string) => win32.normalize(p).normalize('NFC').replace(/\\+$/, '').toLowerCase();
  return norm(dir) === norm(win32.join(localAppData, 'Programs', 'argus'));
}

// Instalado pelo instalador: com o desinstalador ao lado ou na pasta padrão dele. Fora dos dois, o app
// roda de uma pasta copiada, e o instalador instalaria outra cópia em vez de atualizar esta. Só o
// desinstalador não basta: ele pode sumir (antivírus apagando executável sem assinatura, por exemplo),
// e a atualização desligava sem aviso (2026-11-27). Sem ele, o instalador silencioso não consegue
// desinstalar a versão antiga, instala por cima (installUtil.nsh do electron-builder, `DoesNotExist`)
// e cria o desinstalador de novo.
export function installedByInstaller(): boolean {
  return hasUninstaller() || isStandardInstallDir(dirname(process.execPath), process.env.LOCALAPPDATA);
}

export type InstallClues = { uninstaller: boolean; standardDir: boolean };

// Pistas para os avisos da atualização (ver report.ts), sem o caminho, que tem o nome da pessoa.
// Sem o desinstalador na pasta padrão, algo apagou o arquivo depois de instalar; fora dela, o app roda
// de uma cópia da pasta, que de fato não se atualiza.
export function installClues(): InstallClues {
  return {
    uninstaller: hasUninstaller(),
    standardDir: isStandardInstallDir(dirname(process.execPath), process.env.LOCALAPPDATA),
  };
}

// Linha do cmd que roda o instalador e confere o resultado. O instalador desinstala a versão antiga
// antes de copiar a nova e, se a cópia falhar (antivírus segurando ou apagando o Argus.exe recém-
// copiado), termina sem o app: a pasta fica sem o executável. Sem ele no fim, roda o instalador mais
// uma vez. /S, sem telas. --updated: é atualização (fecha o que sobrar do app aberto e mantém os
// atalhos como estão). --force-run: abre o app no fim. O start /wait espera o instalador sair (o cmd
// não espera programa com janela).
export function installerCommand(installer: string, exe: string, relaunch: boolean): string {
  const run = `start "" /wait "${installer}" /S --updated${relaunch ? ' --force-run' : ''}`;
  return `${run} & if not exist "${exe}" ${run}`;
}

// Roda pelo cmd, sem janela de console, solto do app (que sai logo em seguida).
export function spawnInstaller(installer: string, relaunch: boolean): ChildProcess {
  const line = installerCommand(installer, process.execPath, relaunch);
  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    // O Node escaparia as aspas com barra invertida, que o cmd não entende.
    windowsVerbatimArguments: true,
  });
}
