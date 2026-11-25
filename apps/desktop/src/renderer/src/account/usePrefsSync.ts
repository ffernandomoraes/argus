import { useEffect, useEffectEvent } from 'react';
import type { RendererSyncValues } from '@argus/shared/accountSync';
import { IS_REMOTE } from '../remote';
import { setPreferences, usePreferences } from '../settings/preferences';
import { preferencesFromAccount } from './prefsFromAccount';
import type { ThemePreference } from '../theme/useTheme';

// As preferências desta janela que vão para a conta do Argus (a lista e as regras estão em
// packages/shared/src/accountSync.ts): conta ao processo principal as de agora, ao abrir e a cada
// mudança, e aplica as que vieram de outro computador (só o que a tela oferece: prefsFromAccount.ts).
// Zoom e favoritas ficam de fora: são de cada computador. A janela remota não conta (as preferências
// dela são as do notebook).

const isTheme = (v: unknown): v is ThemePreference => v === 'dark' || v === 'light' || v === 'system';

export function usePrefsSync(theme: ThemePreference, setTheme: (t: ThemePreference) => void): void {
  const p = usePreferences();
  const { openIn, conversation, mediaPlayer, promptSuggestions, pinNewDrawers } = p;

  useEffect(() => {
    if (IS_REMOTE) return;
    const prefs: RendererSyncValues = { theme, openIn, conversation, mediaPlayer, promptSuggestions, pinNewDrawers };
    window.api.account.reportPrefs(prefs);
  }, [theme, openIn, conversation, mediaPlayer, promptSuggestions, pinNewDrawers]);

  const apply = useEffectEvent((values: RendererSyncValues) => {
    const patch = preferencesFromAccount(values, p);
    if (Object.keys(patch).length) setPreferences(patch);
    if (isTheme(values.theme) && values.theme !== theme) setTheme(values.theme);
  });
  useEffect(() => {
    if (IS_REMOTE) return;
    return window.api.account.onApplyPrefs((values) => apply(values));
  }, []);
}
