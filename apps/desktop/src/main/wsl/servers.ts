import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import { tr } from '../i18n';
import { childEnv } from '../platform';
import { ensureDistro, WSL_EXE } from './distros';
import { log } from './log';
import { wslCommand } from './run';

// Servidor do projeto (o `dev` do package.json) dentro do WSL. Ele abre num grupo de processos
// próprio (setsid) e grava o número do grupo num arquivo: encerrar o wsl.exe não encerra o que roda
// no Linux, então parar é mandar o sinal ao grupo inteiro (pnpm, vite...) lá dentro.

const RUN_DIR = app.isPackaged ? '.argus/run' : '.argus-dev/run';

export type WslServer = { child: ChildProcess; stop: () => Promise<void>; stopSync: () => void };

export async function launchInWsl(distro: string, linuxCwd: string, command: string): Promise<WslServer | string> {
  const info = await ensureDistro(distro);
  if (!info) return tr(`Não deu para abrir o WSL (${distro}).`, `Couldn’t open WSL (${distro}).`);
  const pidFile = `${info.home}/${RUN_DIR}/server-${randomUUID()}.pid`;
  // O shell de login interativo carrega o nvm e afins, como o terminal do Linux.
  const script = `echo $$ > '${pidFile}'; exec ${command}`;
  // -w: o processo que o wsl.exe abre já lidera o próprio grupo, e aí o setsid se divide e sai na
  // hora com 0. Sem esperar o filho, o app via o servidor "parado sem erro" logo após o clique.
  const cmd = await wslCommand(distro, info, linuxCwd, ['setsid', '-w', 'bash', '-lic', script], {});
  const child = spawn(cmd.file, cmd.args, { env: childEnv(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  // Ler o número do grupo e apagar o arquivo, tudo dentro do Linux: pela pasta de rede, do Windows,
  // a leitura síncrona travava o app inteiro enquanto o WSL respondia. Sem o arquivo, o servidor
  // nem chegou a abrir no Linux: só o wsl.exe para fechar.
  const killArgs = ['-d', distro, '--exec', 'sh', '-c', `p=$(cat '${pidFile}' 2>/dev/null) && kill -TERM -- "-$p"; rm -f '${pidFile}'`];
  return {
    child,
    stop: () =>
      new Promise<void>((resolve) => {
        execFile(WSL_EXE, killArgs, { timeout: 10_000, windowsHide: true }, (err) => {
          if (err) log(`não deu para parar o servidor no WSL (${distro})`, err.message);
          child.kill();
          resolve();
        });
      }),
    // Fechando o app, que não espera nada assíncrono: o encerramento segue sozinho, sem segurar a
    // saída (antes eram até 5 s por servidor, um depois do outro).
    stopSync: () => {
      const fail = (err: Error) => log(`não deu para parar o servidor no WSL (${distro})`, err.message);
      try {
        spawn(WSL_EXE, killArgs, { detached: true, stdio: 'ignore', windowsHide: true }).on('error', fail).unref();
      } catch (err) {
        fail(err as Error);
      }
      child.kill();
    },
  };
}

// Portas que o servidor anunciou na saída ("Local: http://localhost:5173/"). No WSL o Windows não
// mostra quem abriu a porta (aparece o wslrelay.exe, ou nada), então é pela saída que o app sabe.
export function portsInOutput(text: string): number[] {
  const ports = new Set<number>();
  // O Vite destaca a porta com cor (códigos ANSI no meio do endereço).
  const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
  for (const m of plain.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])(?::(\d{2,5}))/gi)) {
    const port = Number(m[1]);
    if (port > 0 && port < 65536) ports.add(port);
  }
  return [...ports].sort((a, b) => a - b);
}
