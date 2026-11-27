import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { UpdateState } from '@argus/shared/updates';
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile';

// Desde quando a atualização não funciona nesta versão (conferências falhando, ou desligada),
// guardado entre aberturas: o erro de cada conferência some na seguinte, e só a soma mostra que a
// pessoa está parada. Com um dia assim, a barra de título avisa e oferece o instalador (UpdateTrouble,
// na janela). Caso de 2026-11-27: Windows parado na 0.1.152 por seis dias sem nada na tela.

// version: a versão em uso quando começou. Com outra versão em uso, a atualização entrou de algum
// jeito (instalada à mão, por exemplo) e a contagem recomeça.
export type Trouble = { since: number; version: string };

const file = () => join(app.getPath('userData'), 'update-trouble.json');

// O registro depois de uma conferência. ok: deu certo, ou há versão baixada esperando o reinício.
export function nextTrouble(saved: Trouble | null, ok: boolean, version: string, now: number): Trouble | null {
  if (ok) return null;
  return saved?.version === version ? saved : { since: now, version };
}

function valid(data: unknown): Trouble | null {
  const t = data as Partial<Trouble> | null;
  return typeof t?.since === 'number' && typeof t.version === 'string' ? { since: t.since, version: t.version } : null;
}

// Lido uma vez: o estado da atualização é lido a cada pedido da janela.
let cached: Trouble | null | undefined;

function load(): Trouble | null {
  if (cached === undefined) {
    const r = readJsonFile(file());
    cached = r.status === 'ok' ? valid(r.data) : null;
  }
  return cached;
}

// Só no app instalado: em desenvolvimento a atualização fica sempre desligada.
export function recordTrouble(ok: boolean, now = Date.now()): void {
  if (!app.isPackaged) return;
  const previous = load();
  const next = nextTrouble(previous, ok, app.getVersion(), now);
  if (next === previous) return;
  cached = next;
  try {
    if (next) writeJsonAtomicSync(file(), next);
    else rmSync(file(), { force: true });
  } catch {
    // Sem gravar, a contagem recomeça na próxima abertura: o aviso só demora mais a aparecer.
  }
}

// O estado que a janela recebe: com o "desde quando" onde a atualização não funciona.
export function withSince(state: UpdateState): UpdateState {
  if (!app.isPackaged || (state.status !== 'error' && state.status !== 'unsupported')) return state;
  const t = load();
  return t?.version === app.getVersion() ? { ...state, since: t.since } : state;
}
