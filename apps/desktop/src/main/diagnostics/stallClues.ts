import { readFileSync } from 'node:fs';

// O que segurou o processo principal numa parada (ver watchMainLag em errorReports/snapshot.ts). A pilha
// do relatório de travamento só mostra onde o JavaScript voltou a rodar: numa parada fora dele (código
// nativo do Electron, o sistema, a máquina virtual parada), ela cai em qualquer relógio leve do app.
// 2026-11-23: 15 relatórios de uma máquina virtual com Ubuntu, cada um num lugar diferente, e nada dizia
// quem tinha parado. Estes números separam as hipóteses, medidos do tique anterior do relógio até o
// atual (a parada mais o intervalo de 1 s):
// - cpuMs: CPU gasta pelo processo principal inteiro (todas as linhas de execução dele). Perto da parada
//   inteira: ele trabalhou o tempo todo, em código nativo. Perto de zero: ficou esperando (disco, outro
//   programa) ou nem chegou a rodar.
// - stealMs (Linux): tempo que o hipervisor tirou de cada CPU da máquina virtual. Perto da parada inteira:
//   a máquina virtual toda ficou parada pelo computador que a hospeda.
// - iowaitMs (Linux): tempo de cada CPU parada esperando o disco (inclui memória voltando do swap).

// Unidade do /proc/stat: USER_HZ, 100 por segundo no Linux.
const PROC_STAT_UNIT_MS = 10;

type ProcStat = { iowait: number; steal: number; cpus: number };

// Primeira linha: "cpu  user nice system idle iowait irq softirq steal ...", a soma de todas as CPUs;
// depois, uma linha por CPU ("cpu0", "cpu1"...).
export function parseProcStat(text: string): ProcStat | null {
  const lines = text.split('\n');
  const total = lines[0]?.trim().split(/\s+/) ?? [];
  if (total[0] !== 'cpu') return null;
  const field = (i: number) => Number(total[i]) || 0;
  const cpus = lines.filter((line) => /^cpu\d+\s/.test(line)).length || 1;
  return { iowait: field(5), steal: field(8), cpus };
}

export type StallClues = { cpuMs: number; stealMs?: number; iowaitMs?: number };

type Readers = { cpuUsage: () => NodeJS.CpuUsage; procStat: () => string | null };

// O /proc/stat é gerado pelo kernel na hora, sem disco: a leitura a cada segundo custa microssegundos.
const SYSTEM_READERS: Readers = {
  cpuUsage: () => process.cpuUsage(),
  procStat: () => (process.platform === 'linux' ? readFileSync('/proc/stat', 'utf8') : null),
};

// Chamada a cada tique do relógio: devolve o que mudou desde a chamada anterior.
export function stallMeter(read: Readers = SYSTEM_READERS): () => StallClues {
  const readStat = (): ProcStat | null => {
    try {
      const text = read.procStat();
      return text ? parseProcStat(text) : null;
    } catch {
      return null;
    }
  };
  let cpu = read.cpuUsage();
  let stat = readStat();
  return () => {
    const nextCpu = read.cpuUsage();
    const nextStat = readStat();
    const clues: StallClues = { cpuMs: Math.round((nextCpu.user - cpu.user + nextCpu.system - cpu.system) / 1000) };
    if (stat && nextStat) {
      const perCpu = (before: number, after: number) => Math.round(((after - before) * PROC_STAT_UNIT_MS) / nextStat.cpus);
      clues.stealMs = perCpu(stat.steal, nextStat.steal);
      clues.iowaitMs = perCpu(stat.iowait, nextStat.iowait);
    }
    cpu = nextCpu;
    stat = nextStat;
    return clues;
  };
}
