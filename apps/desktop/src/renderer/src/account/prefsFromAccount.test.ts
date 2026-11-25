import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SessionSettings } from '../conversation/SessionSettings';
import { conversationFromAccount, preferencesFromAccount } from './prefsFromAccount';

// As preferências que vêm da conta: só o que a tela oferece entra; o modo que deixa o agente agir
// sem pedir nunca vem de fora.

const here = (patch: Partial<SessionSettings> = {}): SessionSettings => ({ ...DEFAULT_SETTINGS, model: 'opus', ...patch });

describe('conversationFromAccount', () => {
  it('applies the safe modes and the model from the account', () => {
    expect(conversationFromAccount({ model: 'claude-sonnet-4-5[1m]', effort: 'high', permissionMode: 'plan', thinking: true }, here())).toEqual({
      ...here(),
      model: 'claude-sonnet-4-5[1m]',
      effort: 'high',
      permissionMode: 'plan',
      thinking: true,
    });
    expect(conversationFromAccount({ permissionMode: 'acceptEdits' }, here())?.permissionMode).toBe('acceptEdits');
    expect(conversationFromAccount({ permissionMode: '' }, here({ permissionMode: 'plan' }))?.permissionMode).toBe('');
  });

  it('never brings auto or bypassPermissions, and keeps the one chosen here', () => {
    expect(conversationFromAccount({ permissionMode: 'bypassPermissions' }, here())?.permissionMode).toBe('');
    expect(conversationFromAccount({ permissionMode: 'auto' }, here({ permissionMode: 'plan' }))?.permissionMode).toBe('plan');
    expect(conversationFromAccount({ permissionMode: 'dontAsk' }, here({ permissionMode: 'manual' }))?.permissionMode).toBe('manual');
    expect(conversationFromAccount({ permissionMode: 'manual' }, here({ permissionMode: 'bypassPermissions' }))?.permissionMode).toBe('bypassPermissions');
  });

  it('keeps the model and effort from here when the account sends something that is not a name', () => {
    const got = conversationFromAccount({ model: 'opus\n!rm -rf ~', effort: '--dangerously-skip-permissions' }, here({ effort: 'max' }));
    expect(got?.model).toBe('opus');
    expect(got?.effort).toBe('max');
  });
});

describe('preferencesFromAccount', () => {
  it('takes only known values', () => {
    const patch = preferencesFromAccount({ openIn: 'tab', mediaPlayer: 'yes', promptSuggestions: false, conversation: 'x' }, { conversation: here() });
    expect(patch).toEqual({ promptSuggestions: false });
  });
});
