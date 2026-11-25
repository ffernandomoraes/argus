import type { RendererSyncValues } from '@argus/shared/accountSync';
import type { SessionSettings } from '../conversation/SessionSettings';
import type { Preferences } from '../settings/preferences';

// O que a janela aplica das preferências que vieram da conta (outro computador, ou quem tiver a
// sessão da conta). Só valores que a tela oferece; fora disso, fica o daqui. Valor fora do formato
// (de outra versão do app) também fica de fora.

const BOOLEANS = ['mediaPlayer', 'promptSuggestions', 'pinNewDrawers'] as const;

// Modos de permissão que a conta pode trazer: os que pedem aprovação, só planejam ou só editam
// arquivos. "Auto" e "Ignorar permissões" valem só no computador onde a pessoa escolheu: vindos da
// conta, deixariam o agente rodar comandos sem pedir aqui. E quem escolheu um deles aqui continua com
// ele: a mudança de outro computador não troca.
const SAFE_MODES = new Set(['', 'manual', 'plan', 'acceptEdits']);

// Modelo e esforço viram argumentos do `claude`: só nomes simples, sem espaço, quebra de linha ou
// traço na frente.
const ARG = /^(?:[A-Za-z0-9][\w.:/@[\]-]{0,99})?$/;
const argOr = (v: unknown, keep: string): string => (typeof v === 'string' && ARG.test(v) ? v : keep);

export function conversationFromAccount(v: unknown, current: SessionSettings): SessionSettings | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  const mode = s.permissionMode;
  return {
    ...current,
    model: argOr(s.model, current.model),
    effort: argOr(s.effort, current.effort),
    thinking: s.thinking === true,
    ultracode: s.ultracode === true,
    permissionMode: typeof mode === 'string' && SAFE_MODES.has(mode) && SAFE_MODES.has(current.permissionMode) ? mode : current.permissionMode,
  };
}

export function preferencesFromAccount(values: RendererSyncValues, current: Pick<Preferences, 'conversation'>): Partial<Preferences> {
  const patch: Partial<Preferences> = {};
  if (values.openIn === 'panel' || values.openIn === 'window' || values.openIn === 'node') patch.openIn = values.openIn;
  for (const k of BOOLEANS) {
    const v = values[k];
    if (typeof v === 'boolean') patch[k] = v;
  }
  const conversation = conversationFromAccount(values.conversation, current.conversation);
  if (conversation) patch.conversation = conversation;
  return patch;
}
