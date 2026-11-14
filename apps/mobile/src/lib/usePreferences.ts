import { useEffect, useLayoutEffect } from 'react';
import { LANGUAGE, resolveLanguage } from '../i18n';
import { useDesktopPreferences } from './data';
import { applyTheme, DESKTOP_LANGUAGE_KEY, effectivePreferences, usePhonePreferences, type EffectivePreferences } from './preferences';

// As preferências que valem agora: as escolhidas neste celular e, no que não foi escolhido, as do
// Argus do computador.
export function usePreferences(): EffectivePreferences {
  return effectivePreferences(usePhonePreferences(), useDesktopPreferences());
}

// Aplica o tema e acompanha o idioma herdado do computador. O idioma vale desde o primeiro texto:
// mudou lá (e não há escolha aqui), guarda e recarrega o app.
export function ApplyPreferences(): null {
  const phone = usePhonePreferences();
  const desktop = useDesktopPreferences();
  const { theme } = effectivePreferences(phone, desktop);
  useLayoutEffect(() => applyTheme(theme), [theme]);
  const desktopLanguage = desktop?.language;
  useEffect(() => {
    if (!desktopLanguage || phone.language) return;
    try {
      localStorage.setItem(DESKTOP_LANGUAGE_KEY, desktopLanguage);
      // Sem gravar (armazenamento bloqueado), recarregar voltaria ao mesmo idioma sem parar.
      if (localStorage.getItem(DESKTOP_LANGUAGE_KEY) !== desktopLanguage) return;
    } catch {
      return;
    }
    if (resolveLanguage(desktopLanguage) !== LANGUAGE) location.reload();
  }, [desktopLanguage, phone.language]);
  return null;
}
