import { describe, expect, it } from 'vitest';
import type { StorageSettings } from '@argus/shared/storage';
import { applyMainValues, type MainSettingsHooks } from './mainSettings';

// As preferências do processo principal que vêm da conta: só os prazos que a aba Armazenamento
// oferece entram (um prazo de 1 dia apagaria o histórico do Claude Code).

function hooks(storage: StorageSettings) {
  const applied: Partial<StorageSettings>[] = [];
  const h: MainSettingsHooks = {
    language: () => undefined,
    menuBarIcon: () => undefined,
    storage: () => storage,
    setStorage: (patch) => applied.push(patch),
  };
  return { h, applied };
}

describe('applyMainValues', () => {
  it('takes only the periods the storage tab offers', () => {
    const { h, applied } = hooks({ conversationDays: 90, scratchDays: 7, mediaDays: 60 });
    applyMainValues({ storage: { conversationDays: 1, scratchDays: 3, mediaDays: 45 } }, h);
    expect(applied).toEqual([{ scratchDays: 3 }]);
  });

  it('ignores the same values and values out of format', () => {
    const { h, applied } = hooks({ conversationDays: 90, scratchDays: 7, mediaDays: 60 });
    applyMainValues({ storage: { conversationDays: 90, scratchDays: '1', mediaDays: 3650 } }, h);
    applyMainValues({ storage: 'x' }, h);
    expect(applied).toEqual([]);
  });
});
