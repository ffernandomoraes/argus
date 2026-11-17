import { spawn } from 'node:child_process';
import type { TextSearchOptions } from '@argus/shared/files';
import { gitCommand } from '../gitBranch/git';

// Uma linha achada pelo git: caminho relativo à pasta, número da linha e o texto inteiro dela.
export type GrepLine = { path: string; line: number; text: string };

// O que o git respondeu: as linhas (até onde a busca foi), ou que a pasta não é repositório (ou o
// git não existe: quem chamou procura de outro jeito), ou o erro dele.
export type GrepOutcome = { kind: 'done'; truncated: boolean } | { kind: 'noRepo' } | { kind: 'error'; message: string };

// No WSL o primeiro wsl.exe pode ligar a máquina virtual.
const TIMEOUT = 30_000;
const WSL_TIMEOUT = 60_000;

// A flag do tipo de busca: texto exato, PCRE (a expressão regular parecida com a do VS Code) ou,
// num git compilado sem PCRE, a ERE do POSIX.
type Mode = '-F' | '-P' | '-E';

function grepArgs(query: string, opts: TextSearchOptions, mode: Mode): string[] {
  return [
    'grep',
    // Caminho, número e texto separados por \0: nome com ":" não confunde.
    '-z',
    '-n',
    // Sem binários; com os arquivos novos ainda fora do git (mas não os do .gitignore).
    '-I',
    '--untracked',
    '--no-color',
    ...(opts.caseSensitive ? [] : ['-i']),
    ...(opts.wholeWord ? ['-w'] : []),
    mode,
    // -e: termo começando com "-" não vira opção.
    '-e',
    query,
  ];
}

// Busca com o `git grep` na pasta (e nas de dentro), lendo a saída aos poucos: `onLine` recebe cada
// linha e devolve false para parar (limite de resultados). Respeita o .gitignore e pula binários.
export function gitGrep(
  base: string,
  query: string,
  opts: TextSearchOptions,
  { onLine, signal }: { onLine: (hit: GrepLine) => boolean; signal: AbortSignal },
): Promise<GrepOutcome> {
  const run = (mode: Mode): Promise<GrepOutcome> =>
    new Promise((done) => {
      const cmd = gitCommand(base, grepArgs(query, opts, mode));
      const child = spawn(cmd.file, cmd.args, { cwd: cmd.cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stopped = false;
      let rest = '';
      let stderr = '';
      const stop = () => {
        if (stopped) return;
        stopped = true;
        child.kill();
      };
      const timer = setTimeout(stop, cmd.wsl ? WSL_TIMEOUT : TIMEOUT);
      signal.addEventListener('abort', stop, { once: true });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        if (stopped) return;
        const records = (rest + chunk).split('\n');
        rest = records.pop() ?? '';
        for (const record of records) {
          const a = record.indexOf('\0');
          const b = record.indexOf('\0', a + 1);
          if (a < 0 || b < 0) continue;
          if (!onLine({ path: record.slice(0, a), line: Number(record.slice(a + 1, b)), text: record.slice(b + 1) })) return stop();
        }
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => (stderr += chunk));
      // Sem git instalado (ENOENT): o 'close' não vem em todo caso; o 'error' resolve.
      child.on('error', () => {
        clearTimeout(timer);
        done({ kind: 'noRepo' });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', stop);
        // Parado por nós (limite, prazo, busca nova): o que chegou vale.
        if (stopped) return done({ kind: 'done', truncated: true });
        // 1: nada encontrado.
        if (code === 0 || code === 1) return done({ kind: 'done', truncated: false });
        if (/not a git repository/i.test(stderr)) return done({ kind: 'noRepo' });
        done({ kind: 'error', message: stderr.trim().split('\n')[0] || `git grep: ${code}` });
      });
    });

  if (!opts.regex) return run('-F');
  return run('-P').then((res) =>
    // git compilado sem PCRE ("cannot use Perl-compatible regexes"): tenta a ERE.
    res.kind === 'error' && /perl|pcre/i.test(res.message) ? run('-E') : res,
  );
}
