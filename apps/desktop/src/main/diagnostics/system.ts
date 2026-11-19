import { freemem, loadavg, totalmem, uptime } from 'node:os';
import { powerMonitor } from 'electron';
import { IS_WIN } from '../platform';
import { note } from './journal';

// O que o computador fez (dormiu, acordou, bloqueou a tela, ficou na bateria) e quando. Boa parte
// dos travamentos e das falhas de rede vem logo depois de o computador acordar: com a hora certa no
// relatório, dá para afirmar ou descartar isso. As horas vão absolutas: o relatório de travamento do
// processo principal leva o estado de alguns segundos antes (ver errorReports/journalReport.ts), e a
// conta "quanto tempo depois de acordar" se faz com a hora do próprio evento.

type PowerMark = 'suspend' | 'resume' | 'lock' | 'unlock';

const marks: Record<PowerMark, number> = { suspend: 0, resume: 0, lock: 0, unlock: 0 };
const appStartedAt = Date.now();
let onBattery: boolean | null = null;
let thermalState: string | null = null;

const POWER_NOTES: [string, string, PowerMark | null][] = [
  ['suspend', 'computador dormiu', 'suspend'],
  ['resume', 'computador acordou', 'resume'],
  ['lock-screen', 'tela bloqueada', 'lock'],
  ['unlock-screen', 'tela desbloqueada', 'unlock'],
  ['shutdown', 'sistema desligando', null],
];

// Depois de o app ficar pronto (o powerMonitor só funciona a partir daí).
export function watchSystem(): void {
  for (const [event, text, mark] of POWER_NOTES) {
    powerMonitor.on(event as 'suspend', () => {
      if (mark) marks[mark] = Date.now();
      note('system', text);
    });
  }
  onBattery = powerMonitor.isOnBatteryPower();
  powerMonitor.on('on-battery', () => {
    onBattery = true;
    note('system', 'na bateria');
  });
  powerMonitor.on('on-ac', () => {
    onBattery = false;
    note('system', 'na tomada');
  });
  // Mac: o sistema segurando a CPU por calor. A mudança de limite da CPU (speed-limit-change) fica de
  // fora: muda o tempo todo e não diz mais que isto.
  powerMonitor.on('thermal-state-change', () => {
    thermalState = powerMonitor.getCurrentThermalState?.() ?? null;
    note('system', 'temperatura do computador', { state: thermalState });
  });
}

// Há quanto tempo o computador acordou; null se não dormiu com o app aberto.
export const msSinceResume = (now = Date.now()): number | null => (marks.resume ? now - marks.resume : null);

const iso = (at: number) => (at ? new Date(at).toISOString() : null);
const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

export function systemState(now = Date.now()): Record<string, string | number | boolean | null> {
  return {
    lastSuspendAt: iso(marks.suspend),
    lastResumeAt: iso(marks.resume),
    lastLockAt: iso(marks.lock),
    lastUnlockAt: iso(marks.unlock),
    // No Windows, o tempo ligado conta também o tempo dormindo.
    bootAt: iso(now - uptime() * 1000),
    appStartedAt: iso(appStartedAt),
    onBattery,
    thermalState,
    // O Windows não tem a carga do sistema (sempre 0).
    load1m: IS_WIN ? null : Math.round(loadavg()[0] * 100) / 100,
    freeMemoryMB: mb(freemem()),
    totalMemoryMB: mb(totalmem()),
  };
}
