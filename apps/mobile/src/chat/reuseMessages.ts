import type { Message } from '@argus/shared/history';

// Cópia de apps/desktop/src/renderer/src/conversation/reuseMessages.ts. O histórico chega inteiro a
// cada leitura, com objetos novos. Mensagem que não mudou volta a ser o mesmo objeto da leitura
// anterior, e a lista toda também quando nada mudou: as linhas memorizadas não redesenham a cada
// passo do agente.
export function reuseMessages(prev: readonly Message[], next: Message[]): Message[] {
  if (!prev.length) return next;
  const byId = new Map(prev.map((m) => [m.id, m]));
  let same = prev.length === next.length;
  const out = next.map((m, i) => {
    const old = byId.get(m.id);
    const kept = old && sameJson(old, m) ? old : m;
    if (kept !== prev[i]) same = false;
    return kept;
  });
  return same ? (prev as Message[]) : out;
}

// Igualdade de valores simples (texto, número, booleano, nulo, lista e objeto). Para no primeiro
// campo diferente.
function sameJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const list = b as unknown[];
    return a.length === list.length && a.every((v, i) => sameJson(v, list[i]));
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  if (keys.length !== Object.keys(y).length) return false;
  return keys.every((k) => Object.hasOwn(y, k) && sameJson(x[k], y[k]));
}
