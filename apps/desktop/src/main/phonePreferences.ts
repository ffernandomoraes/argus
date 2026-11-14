import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, nativeTheme } from 'electron';
import type { ChatSettings } from '@argus/shared/chat';
import type { DesktopPreferences, SharedPreferences } from '@argus/shared/phonePreferences';
import { loadAppSettings } from './appSettings';

// O que o app do celular herda do Argus (até a pessoa escolher outro no próprio celular): o padrão
// de modelo, esforço e modo das conversas novas e as sugestões de próxima mensagem, que ficam nos
// ajustes da janela (ela conta para cá ao abrir e a cada mudança, e fica guardado num arquivo para
// valer antes de a janela abrir), e o tema e o idioma, que o processo principal já conhece.

const file = () => join(app.getPath('userData'), 'phone-preferences.json');
let cache: SharedPreferences | null | undefined;

const text = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : '');

function conversationOf(raw: unknown): ChatSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  return { model: text(s.model), effort: text(s.effort), thinking: s.thinking === true, ultracode: s.ultracode === true, permissionMode: text(s.permissionMode) };
}

function normalize(raw: unknown): SharedPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const conversation = conversationOf(p.conversation);
  return conversation ? { conversation, suggestions: p.suggestions !== false } : null;
}

function shared(): SharedPreferences | null {
  if (cache !== undefined) return cache;
  try {
    cache = existsSync(file()) ? normalize(JSON.parse(readFileSync(file(), 'utf8'))) : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function phonePreferences(): DesktopPreferences {
  const s = shared();
  return { conversation: s?.conversation ?? null, suggestions: s?.suggestions ?? null, theme: nativeTheme.themeSource, language: loadAppSettings().language };
}

export function sharePreferences(raw: unknown): void {
  const next = normalize(raw);
  if (!next || JSON.stringify(next) === JSON.stringify(shared())) return;
  cache = next;
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(file(), JSON.stringify(next));
  } catch (err) {
    console.error('[preferências do celular] não deu para gravar:', err);
  }
}
