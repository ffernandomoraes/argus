import { readdir, readFile } from 'node:fs/promises';
import { IS_LINUX, IS_WIN } from '../platform';
import { CLAUDE_SCRIPT, isClaudeCommand } from '../processScan/family';
import { nulList, parseStat } from '../processScan/linuxParse';
import { output, PS } from '../processScan/run';
import { mapLimit } from '../transcripts/mapLimit';
import { processTable } from '../winProcesses';

// Quantos Claude Code estão rodando neste computador fora do Argus, e quem abriu cada um (o terminal,
// o VS Code, o app do Claude). Para o aviso de login perdido: dois programas renovando o mesmo login ao
// mesmo tempo é uma das causas possíveis, e esta conta confirma ou descarta. Feita só na hora do
// aviso. No Windows, os do Linux do WSL ficam de fora (rodam dentro da máquina virtual).

export type Proc = { pid: number; ppid: number; command: string; name?: string };
export type ClaudeCensus = { total: number; outsideArgus: number; parents: string[] };

const PARENTS_SHOWN = 5;

// O nome do programa, sem a pasta (que pode ter o nome da pessoa) e sem os argumentos. No Mac, o de um
// app é o do pacote mais de dentro (".../Visual Studio Code.app/.../Code Helper (Plugin).app/..."): o
// caminho tem espaços, e a primeira palavra não diria nada.
export function programName(p: Proc | undefined): string {
  if (!p) return '?';
  if (p.name) return p.name;
  const bundle = [...p.command.matchAll(/([^/]+)\.app\//g)].at(-1)?.[1];
  if (bundle) return bundle.slice(0, 40);
  const first = p.command.match(/^"([^"]+)"|^(\S+)/);
  // As duas barras: o caminho do Windows também vem com a barra invertida.
  return ((first?.[1] ?? first?.[2] ?? '?').split(/[\\/]/).pop() || '?').slice(0, 40);
}

// É do Argus quem tem o processo principal do Argus (ownPid) entre os de cima.
function fromArgus(byPid: Map<number, Proc>, p: Proc, ownPid: number): boolean {
  for (let at: Proc | undefined = p, steps = 0; at && steps < 64; at = byPid.get(at.ppid), steps++) {
    if (at.ppid === ownPid) return true;
  }
  return false;
}

// Os Claude Code de dentro de outro Claude Code (o de uma ferramenta, um subagente) contam uma vez só.
export function countClaudes(procs: Proc[], isClaude: (p: Proc) => boolean, ownPid: number): ClaudeCensus {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const claudes = procs.filter((p) => isClaude(p) && !isClaude(byPid.get(p.ppid) ?? { pid: 0, ppid: 0, command: '' }));
  const outside = claudes.filter((p) => !fromArgus(byPid, p, ownPid));
  return {
    total: claudes.length,
    outsideArgus: outside.length,
    parents: [...new Set(outside.map((p) => programName(byPid.get(p.ppid))))].slice(0, PARENTS_SHOWN),
  };
}

async function macProcs(): Promise<Proc[]> {
  const text = await output(PS, ['-ax', '-ww', '-o', 'pid=,ppid=,args=']);
  return text.split('\n').flatMap((line) => {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    return m ? [{ pid: Number(m[1]), ppid: Number(m[2]), command: m[3].trim() }] : [];
  });
}

async function linuxProcs(): Promise<Proc[]> {
  const text = (path: string) => readFile(path, 'utf8').catch(() => '');
  const pids = (await readdir('/proc').catch(() => [] as string[])).filter((n) => /^\d+$/.test(n)).map(Number);
  const out: Proc[] = [];
  await mapLimit(pids, 32, async (pid) => {
    const stat = parseStat(await text(`/proc/${pid}/stat`));
    if (stat) out.push({ pid, ppid: stat.ppid, command: nulList(await text(`/proc/${pid}/cmdline`)) });
  });
  return out;
}

async function windowsProcs(): Promise<Proc[]> {
  return [...(await processTable(0)).values()].map((p) => ({ pid: p.pid, ppid: p.ppid, command: p.command, name: p.name }));
}

const isClaudeProc = (p: Proc): boolean =>
  IS_WIN ? /^claude\.exe$/i.test(p.name ?? '') || CLAUDE_SCRIPT.test(p.command) : isClaudeCommand(p.command);

export async function claudeCensus(): Promise<ClaudeCensus> {
  const procs = IS_WIN ? await windowsProcs() : IS_LINUX ? await linuxProcs() : await macProcs();
  return countClaudes(procs, isClaudeProc, process.pid);
}
