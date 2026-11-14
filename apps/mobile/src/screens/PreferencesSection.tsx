import { useState } from 'react';
import type { ChatSettings } from '@argus/shared/chat';
import type { LangPreference } from '@argus/shared/i18n';
import type { ThemeSource } from '@argus/shared/ipc';
import { resolveAccount } from '../chat/AccountPicker';
import { ComposerOptions, type OptionsSheet } from '../chat/ComposerBar';
import { DEFAULT_SETTINGS, MODES, effortLabel } from '../chat/options';
import { LANGUAGE, resolveLanguage, tr } from '../i18n';
import { useAgentInfo, useAuthState, useProvidersState } from '../lib/data';
import { savePhonePreferences, usePhonePreferences, type PhonePreferences } from '../lib/preferences';
import { usePreferences } from '../lib/usePreferences';
import { ChoiceSheet } from '../ui/ChoiceSheet';
import { Row, Section } from '../ui/List';
import { Toggle } from '../ui/Toggle';

// Conta > Preferências: idioma, tema, sugestões e o padrão das conversas novas. Começam iguais ao
// Argus do computador; o que mudar aqui vale só neste celular.

const LANGUAGES: { value: LangPreference; label: string }[] = [
  { value: 'system', label: tr('Do sistema', 'System') },
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
];

const THEMES: { value: ThemeSource; label: string }[] = [
  { value: 'system', label: tr('Do sistema', 'System') },
  { value: 'light', label: tr('Claro', 'Light') },
  { value: 'dark', label: tr('Escuro', 'Dark') },
];

const labelOf = <T extends string>(list: { value: T; label: string }[], value: T) => list.find((o) => o.value === value)?.label ?? value;

export function PreferencesSection() {
  const prefs = usePreferences();
  const phone = usePhonePreferences();
  const [choice, setChoice] = useState<'language' | 'theme' | null>(null);
  const [sheet, setSheet] = useState<OptionsSheet>(null);
  // Modelos e modo padrão da conta padrão do Claude (as do grupo podem ter outra conta).
  const account = resolveAccount(undefined, useAuthState(), useProvidersState());
  const info = useAgentInfo(account?.id);
  const conversation = prefs.conversation ?? DEFAULT_SETTINGS;
  const model = info?.models.find((m) => m.value === conversation.model) ?? info?.models.find((m) => m.value === '');
  const modelName = model ? (model.value === '' ? (model.resolvedName ?? tr('Padrão', 'Default')) : model.displayName) : conversation.model || tr('Padrão', 'Default');
  const mode = MODES.find((m) => m.value === (conversation.permissionMode || info?.defaultPermissionMode || 'manual')) ?? MODES[0];
  const changed = Object.keys(phone).length > 0;

  const pickLanguage = (language: LangPreference) => {
    savePhonePreferences({ language });
    // Os textos são lidos uma vez, ao abrir: o idioma novo vale recarregando.
    if (resolveLanguage(language) !== LANGUAGE) location.reload();
  };
  const changeConversation = (patch: Partial<ChatSettings>) => savePhonePreferences({ conversation: { ...conversation, ...patch } });

  return (
    <>
      <Section
        title={tr('Preferências', 'Preferences')}
        footer={tr('Começam iguais às do Argus no computador. O que mudar aqui vale só neste celular.', 'They start the same as Argus on the computer. Changes here apply only to this phone.')}
      >
        <Row title={tr('Idioma', 'Language')} trailing={labelOf(LANGUAGES, prefs.language)} onClick={() => setChoice('language')} />
        <Row title={tr('Tema', 'Theme')} trailing={labelOf(THEMES, prefs.theme)} onClick={() => setChoice('theme')} />
        <Row
          title={tr('Sugestões de mensagem', 'Message suggestions')}
          trailing={<Toggle on={prefs.suggestions} label={tr('Sugestões de mensagem', 'Message suggestions')} onChange={(suggestions) => savePhonePreferences({ suggestions })} />}
        />
      </Section>

      <Section
        title={tr('Conversas novas', 'New chats')}
        footer={tr('Modelo, esforço e modo com que as conversas começam. Dá para trocar em cada conversa, pelo +.', 'Model, effort and mode that chats start with. You can change them in each chat, with +.')}
      >
        <Row title={tr('Modelo', 'Model')} trailing={modelName} onClick={() => setSheet('model')} />
        <Row title={tr('Esforço', 'Effort')} trailing={effortLabel(conversation.effort)} onClick={() => setSheet('effort')} />
        <Row title={tr('Modo', 'Mode')} trailing={mode.label} onClick={() => setSheet('mode')} />
      </Section>

      {changed && (
        <Section>
          <Row
            title={<span className="text-accent">{tr('Voltar às do computador', 'Use the computer settings')}</span>}
            chevron={false}
            onClick={() => {
              const reload = !!phone.language && resolveLanguage(phone.language) !== LANGUAGE;
              savePhonePreferences(Object.fromEntries(Object.keys(phone).map((k) => [k, undefined])) as PhonePreferences);
              if (reload) location.reload();
            }}
          />
        </Section>
      )}

      <ChoiceSheet open={choice === 'language'} title={tr('Idioma', 'Language')} options={LANGUAGES} value={prefs.language} onPick={pickLanguage} onClose={() => setChoice(null)} />
      <ChoiceSheet open={choice === 'theme'} title={tr('Tema', 'Theme')} options={THEMES} value={prefs.theme} onPick={(theme) => savePhonePreferences({ theme })} onClose={() => setChoice(null)} />
      <ComposerOptions open={sheet} onOpen={setSheet} onAttach={() => {}} settings={conversation} info={info} agentChat={false} onChange={changeConversation} onCommand={() => {}} />
    </>
  );
}
