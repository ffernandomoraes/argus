import { spawn, type ChildProcess } from 'node:child_process';

type Stdin = NonNullable<ChildProcess['stdin']>;

const guarded = new WeakSet<Stdin>();

// O processo pode sair antes de ler tudo (git fora de repositório, `claude` que morreu): a escrita
// vira EPIPE, que sem ouvinte de 'error' é exceção não tratada no processo principal (o diálogo
// de erro do Electron). Com o ouvinte, o erro é só ignorado; quem quer saber se o processo
// terminou bem olha o 'exit'/'close' dele.
export function guardStdin(child: ChildProcess): void {
  const stdin = child.stdin;
  if (!stdin || guarded.has(stdin)) return;
  stdin.on('error', () => {});
  guarded.add(stdin);
}

// Escreve no stdin do processo filho com o ouvinte de erro posto. Por padrão fecha o stdin depois
// (entrada de uma vez, como o `git check-ignore --stdin`); `end: false` para conversa contínua
// (o `claude` do monitor de uso). Devolve false se o stdin já estava fechado.
export function writeStdin(child: ChildProcess, data: string | Uint8Array, { end = true }: { end?: boolean } = {}): boolean {
  const stdin = child.stdin;
  if (!stdin) return false;
  guardStdin(child);
  if (stdin.destroyed || stdin.writableEnded) return false;
  if (end) stdin.end(data);
  else stdin.write(data);
  return true;
}

// Folga para o processo sair sozinho antes de o Argus forçar o fim.
const GENTLE_GRACE_MS = 10_000;

// Fecha um processo com calma: encerra a entrada (o `claude -p` sai sozinho quando ela acaba e, antes
// de sair, termina uma renovação do login que esteja no meio) e só força o fim se ele continuar
// aberto depois de `graceMs`. Matar na hora era o problema: no Windows o kill é imediato, sem chance
// de terminar nada (no WSL, derruba o wsl.exe), e um `claude` morto entre receber o login renovado e
// gravá-lo deixava guardado o antigo, já recusado pelo servidor; o Claude Code então apagava o login
// de todos os `claude` da conta (relato de 2026-11-08, Windows com WSL).
export function closeGently(child: ChildProcess, graceMs = GENTLE_GRACE_MS): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stdin = child.stdin;
  if (stdin && !stdin.destroyed && !stdin.writableEnded) {
    guardStdin(child);
    stdin.end();
  }
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }, graceMs);
  timer.unref();
  child.once('exit', () => clearTimeout(timer));
}

export type RunError = Error & { stdout?: string; stderr?: string; code?: number | null; timedOut?: boolean };

// Como o execFile, mas o prazo só para de esperar: o processo segue aberto por mais `graceMs` antes de
// ser encerrado à força (ver closeGently). Rejeita com stdout e stderr no erro (saída diferente de 0
// ou prazo esgotado), como o execFile.
export function runGently(
  file: string,
  args: string[],
  o: { env?: NodeJS.ProcessEnv; cwd?: string; timeoutMs: number; graceMs?: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { env: o.env, cwd: o.cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const fail = (message: string, extra: Partial<RunError>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(Object.assign(new Error(message), { stdout, stderr }, extra));
    };
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));
    const timer = setTimeout(() => {
      fail(`${file}: sem resposta em ${o.timeoutMs} ms`, { timedOut: true });
      closeGently(child, o.graceMs ?? GENTLE_GRACE_MS);
    }, o.timeoutMs);
    child.on('error', (err) => fail(err.message, {}));
    child.on('close', (code) => {
      if (settled) return;
      if (code === 0) {
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr });
      } else fail(`${file} saiu com ${code}`, { code });
    });
  });
}
