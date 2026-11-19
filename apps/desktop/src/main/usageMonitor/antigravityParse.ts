import type { Usage, UsageWindow } from '@argus/shared/usage';
import { tr } from '../i18n';

// Limites do Antigravity (`agy --output-format json -p /usage`) no formato do app.
// Conferido no agy 1.5.12: a resposta traz grupos de modelos ("Gemini Models", "Claude and GPT
// models"), cada um com seus baldes; cada balde diz a janela, a fração que resta e quando recomeça.
// No plano gratuito, só o semanal de cada grupo.

type RawBucket = { name?: unknown; window?: unknown; remaining_fraction?: unknown; reset_time?: unknown; disabled?: unknown };
type RawGroup = { name?: unknown; buckets?: unknown };

const WEEK_MINS = 10_080;
const FIVE_HOURS_MINS = 300;

// Duração pela janela que o agy informa ("weekly"); sem reconhecer, a tela mostra só "Limite".
function minutesOf(bucket: RawBucket): number | undefined {
  const label = `${typeof bucket.window === 'string' ? bucket.window : ''} ${typeof bucket.name === 'string' ? bucket.name : ''}`;
  if (/week/i.test(label)) return WEEK_MINS;
  if (/daily|\bday\b/i.test(label)) return 1440;
  if (/5.?h|five|hour|session/i.test(label)) return FIVE_HOURS_MINS;
  return undefined;
}

function toWindow(bucket: RawBucket): UsageWindow | null {
  if (bucket.disabled === true || typeof bucket.remaining_fraction !== 'number') return null;
  const percent = Math.round(Math.max(0, Math.min(1, 1 - bucket.remaining_fraction)) * 100);
  const reset = typeof bucket.reset_time === 'string' && !Number.isNaN(Date.parse(bucket.reset_time)) ? bucket.reset_time : null;
  const minutes = minutesOf(bucket);
  return { percent, resetsAt: reset, ...(minutes && { minutes }) };
}

// Janelas do grupo, da mais curta para a mais longa (sem duração, por último).
function windowsOf(group: RawGroup): UsageWindow[] {
  const buckets = Array.isArray(group.buckets) ? (group.buckets as RawBucket[]) : [];
  return buckets
    .map((b) => (b && typeof b === 'object' ? toWindow(b) : null))
    .filter((w): w is UsageWindow => !!w)
    .sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity));
}

// A saída do comando. Nulo: sem limite para mostrar (conta por chave de API, saída que não é a esperada).
// O primeiro grupo (os modelos Gemini) é o da conta; os outros entram como limites à parte, com o nome.
export function antigravityUsage(stdout: string, now: number): Usage | null {
  let groups: RawGroup[];
  try {
    const out = JSON.parse(stdout) as { command?: { data?: { groups?: unknown } } };
    const list = out.command?.data?.groups;
    groups = Array.isArray(list) ? (list.filter((g) => g && typeof g === 'object') as RawGroup[]) : [];
  } catch {
    return null;
  }
  const withWindows = groups.map((g) => ({ name: typeof g.name === 'string' ? g.name : '', windows: windowsOf(g) })).filter((g) => g.windows.length);
  const [main, ...others] = withWindows;
  if (!main) return null;
  // "Claude and GPT models" → "Claude e GPT": a tela já diz que é um limite.
  const short = (name: string) => name.replace(/\s+models$/i, '').replace(/ and /g, tr(' e ', ' and '));
  const models = others.flatMap((g) => g.windows.map((window) => ({ name: short(g.name), window })));
  return { session: main.windows[0], weekly: main.windows[1] ?? null, models, updatedAt: now };
}
