import type { ClaudeInfo, ClaudeModel } from '@argus/shared/models';
import type { Usage, UsageWindow } from '@argus/shared/usage';
import { tr } from '../i18n';

// Respostas do `claude` (stream-json) aos pedidos de controle do monitor, e os limites que chegam nas
// conversas. Lógica pura: o que vale de cada linha.

type RawWindow = { utilization?: number | null; resets_at?: string | null } | null | undefined;

type RawModel = { value: string; displayName: string; description?: string; supportedEffortLevels?: string[] };

// Nome do modelo atual na descrição do padrão. Antes: "Opus 5.5 · Best for..."; desde a 2.1.30x:
// "Use the default model (currently Opus 5.5)".
export function defaultModelName(description?: string): string | undefined {
  if (!description) return undefined;
  const current = description.match(/\(currently ([^)]+)\)/);
  return current ? current[1].trim() : description.split(' · ')[0];
}

function toModels(raw: RawModel[]): ClaudeModel[] {
  return raw.map((m) => {
    const isDefault = m.value === 'default';
    return {
      value: isDefault ? '' : m.value,
      displayName: isDefault ? tr('Padrão', 'Default') : m.displayName,
      resolvedName: isDefault ? defaultModelName(m.description) : undefined,
      efforts: m.supportedEffortLevels ?? [],
    };
  });
}

// Sem mensagem na janela (conta recém-conectada), ela vem sem hora de recomeçar: vale como 0%.
function toWindow(raw: RawWindow): UsageWindow | null {
  if (!raw) return null;
  return { percent: typeof raw.utilization === 'number' ? raw.utilization : 0, resetsAt: raw.resets_at ?? null };
}

type RawScoped = { display_name?: unknown; utilization?: number | null; resets_at?: string | null };

// Semanais de um modelo só, na mesma regra da extensão do VS Code: o do Sonnet (campo próprio, só
// nos planos max e team) e a lista `model_scoped`, que o servidor preenche com o modelo que tem
// limite próprio (hoje, o Fable). Janela nula ou sem porcentagem não aparece.
function toModelWindows(limits: any, plan: unknown): Usage['models'] {
  const all: { name: string; raw: RawWindow }[] = [];
  if (plan === 'max' || plan === 'team' || plan == null) all.push({ name: 'Sonnet', raw: limits.seven_day_sonnet });
  const scoped: RawScoped[] = Array.isArray(limits.model_scoped) ? limits.model_scoped : [];
  for (const m of scoped) if (typeof m?.display_name === 'string') all.push({ name: m.display_name, raw: m });
  return all.flatMap(({ name, raw }) =>
    raw && typeof raw.utilization === 'number' ? [{ name, window: toWindow(raw)! }] : [],
  );
}

type RawLimit = { kind?: unknown; percent?: unknown; resets_at?: string | null; scope?: { model?: { display_name?: unknown } | null } | null };

// Lista `limits`, o formato novo (conferido na 2.1.300): uma linha por janela, com o tipo em `kind`.
// É o que o /usage do Claude Code desenha. Os campos antigos (five_hour...) podem vir nulos com a
// lista preenchida: a sessão estourada aparecia como 0%. Lista com o semanal e sem a sessão: conta
// sem sessão de 5 horas (Ultra verificado). O /usage do Claude Code também tira a linha quando a
// sessão vem nula. null: lista ausente ou sem sessão nem semanal.
function fromLimits(raw: unknown): Usage | null {
  if (!Array.isArray(raw)) return null;
  const rows = (raw as RawLimit[]).filter((r) => typeof r?.percent === 'number');
  const win = (r: RawLimit): UsageWindow => ({ percent: r.percent as number, resetsAt: r.resets_at ?? null });
  const session = rows.find((r) => r.kind === 'session');
  const weekly = rows.find((r) => r.kind === 'weekly_all');
  if (!session && !weekly) return null;
  const models = rows.flatMap((r) => {
    const name = r.scope?.model?.display_name;
    return r.kind === 'weekly_scoped' && typeof name === 'string' ? [{ name, window: win(r) }] : [];
  });
  return {
    session: session ? win(session) : null,
    weekly: weekly ? win(weekly) : null,
    models,
    ...(session ? {} : { noSession: true }),
    updatedAt: 0,
  };
}

// info: resposta ao "init" (modelos, modo de permissão, conta). usage: resposta a um "usage-N"
// com os limites. noLimits: resposta a um "usage-N" sem limites (rate_limits nulo e
// rate_limits_available falso, conferido na 2.1.319 sem login): o `claude` respondeu, não está calado.
// Vazio: outra resposta de sucesso, sem nada para o app.
export type ControlReply = { info?: ClaudeInfo; usage?: Usage; noLimits?: true };

// Resposta de sucesso a um pedido de controle, ou null (outra linha, erro ou JSON quebrado).
export function parseControlReply(line: string, now: number): ControlReply | null {
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    return null;
  }
  const res = msg?.type === 'control_response' ? msg.response : null;
  if (!res || res.subtype !== 'success') return null;

  if (res.request_id === 'init' && Array.isArray(res.response?.models)) {
    const mode = res.response.current_permission_mode;
    return {
      info: {
        models: toModels(res.response.models),
        // Na resposta o modo manual vem como "default"; o --permission-mode chama de "manual".
        defaultPermissionMode: !mode || mode === 'default' ? 'manual' : mode,
        account: res.response.account ?? null,
      },
    };
  }
  if (!String(res.request_id).startsWith('usage-')) return {};

  const usage = parseRateLimits(res.response?.rate_limits, res.response?.subscription_type, now);
  return usage ? { usage } : { noLimits: true };
}

// Os limites no formato do servidor: o corpo do GET /api/oauth/usage, que o `claude` repassa como
// rate_limits na resposta ao get_usage. `plan`: o tipo de assinatura (pro, max, team...). null: sem limites.
export function parseRateLimits(limits: any, plan: unknown, now: number): Usage | null {
  if (!limits || typeof limits !== 'object') return null;
  const fresh = fromLimits(limits.limits);
  if (fresh) return { ...fresh, updatedAt: now };
  // Sessão ausente com o resto presente: a janela de 5 horas ainda não começou.
  const session = toWindow(limits.five_hour) ?? { percent: 0, resetsAt: null };
  return { session, weekly: toWindow(limits.seven_day), models: toModelWindows(limits, plan), updatedAt: now };
}

// Os limites que chegam a cada resposta das conversas (rate_limit_event, `unifiedWindows`, conferido
// na 2.1.322): a porcentagem de 0 a 1 e a hora de recomeçar em segundos, da sessão de 5 horas e do
// semanal. Não traz o semanal de um modelo só (Fable). null: sem nenhuma das duas.
export type ChatWindows = { session?: UsageWindow; weekly?: UsageWindow };

export function parseChatWindows(info: any): ChatWindows | null {
  const raw = info?.unifiedWindows;
  if (!raw || typeof raw !== 'object') return null;
  const win = (w: any): UsageWindow | undefined =>
    typeof w?.utilization === 'number'
      ? {
          percent: Math.round(w.utilization * 100),
          resetsAt: typeof w.resetsAt === 'number' ? new Date(w.resetsAt * 1000).toISOString() : null,
        }
      : undefined;
  const session = win(raw.five_hour);
  const weekly = win(raw.seven_day);
  if (!session && !weekly) return null;
  return { ...(session && { session }), ...(weekly && { weekly }) };
}
