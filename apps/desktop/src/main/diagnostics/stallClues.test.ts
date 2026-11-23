import { describe, expect, it } from 'vitest';
import { parseProcStat, stallMeter } from './stallClues';

// /proc/stat de uma máquina com 4 CPUs: iowait (5º número) e steal (8º) na linha "cpu", a soma de todas.
const procStat = (iowait: number, steal: number): string =>
  [
    `cpu  4705 150 1120 1640000 ${iowait} 0 30 ${steal} 0 0`,
    'cpu0 1200 40 280 410000 0 0 10 0 0 0',
    'cpu1 1100 30 270 410000 0 0 5 0 0 0',
    'cpu2 1250 40 290 410000 0 0 10 0 0 0',
    'cpu3 1155 40 280 410000 0 0 5 0 0 0',
    'intr 123456',
    'ctxt 789',
  ].join('\n');

// Uma sequência de leituras: cada chamada devolve a próxima.
const sequence = <T>(values: T[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('parseProcStat', () => {
  it('lê o iowait e o steal da soma e conta as CPUs', () => {
    expect(parseProcStat(procStat(320, 15))).toEqual({ iowait: 320, steal: 15, cpus: 4 });
  });

  it('texto que não é o /proc/stat não vale', () => {
    expect(parseProcStat('')).toBeNull();
    expect(parseProcStat('intr 1\nctxt 2')).toBeNull();
  });
});

describe('stallMeter', () => {
  it('CPU gasta pelo processo desde o tique anterior, em ms', () => {
    const sinceLastTick = stallMeter({
      cpuUsage: sequence([
        { user: 1_000_000, system: 500_000 },
        { user: 5_200_000, system: 1_300_000 },
      ]),
      procStat: () => null,
    });
    expect(sinceLastTick()).toEqual({ cpuMs: 5000 });
  });

  it('no Linux, o tempo tirado pelo hipervisor e a espera do disco, por CPU', () => {
    // 6 s de máquina virtual parada em 4 CPUs: 2400 unidades de 10 ms na soma.
    const sinceLastTick = stallMeter({
      cpuUsage: sequence([
        { user: 0, system: 0 },
        { user: 20_000, system: 10_000 },
      ]),
      procStat: sequence([procStat(100, 15), procStat(140, 2415)]),
    });
    expect(sinceLastTick()).toEqual({ cpuMs: 30, stealMs: 6000, iowaitMs: 100 });
  });

  it('cada chamada mede desde a anterior', () => {
    const sinceLastTick = stallMeter({
      cpuUsage: sequence([
        { user: 0, system: 0 },
        { user: 2_000_000, system: 0 },
        { user: 2_100_000, system: 0 },
      ]),
      procStat: () => null,
    });
    expect(sinceLastTick().cpuMs).toBe(2000);
    expect(sinceLastTick().cpuMs).toBe(100);
  });

  it('sem /proc/stat legível, só a CPU', () => {
    const sinceLastTick = stallMeter({
      cpuUsage: sequence([
        { user: 0, system: 0 },
        { user: 1000, system: 0 },
      ]),
      procStat: () => {
        throw new Error('EACCES');
      },
    });
    expect(sinceLastTick()).toEqual({ cpuMs: 1 });
  });
});
