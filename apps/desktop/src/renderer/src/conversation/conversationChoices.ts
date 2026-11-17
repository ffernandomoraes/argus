import { mergeChoice, type ConversationChoice } from '@argus/shared/chatChoices';
import { REMOTE_HOST } from '../remote';

// Conta e modelo/esforço/modo de cada conversa, como o Argus que roda a conversa guarda (ver
// packages/shared/src/chatChoices.ts). Esta janela tem uma cópia para ler na hora: começa com todas e
// acompanha as trocas feitas em qualquer janela (daqui ou do acesso remoto) pelo aviso
// chatChoices:changed. A troca feita aqui vale na cópia já, sem esperar a volta.

const choices = new Map<string, ConversationChoice>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeChoices(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const choiceOf = (id: string): ConversationChoice | undefined => choices.get(id);

function apply(id: string, choice: ConversationChoice | null): void {
  if (choice) choices.set(id, choice);
  else choices.delete(id);
}

export function setChoice(id: string, choice: ConversationChoice): void {
  apply(id, mergeChoice(choices.get(id), choice, false));
  emit();
  window.api.chat.choices.set(id, choice);
}

// Sem passar por cima do que já foi escolhido, aqui ou em outra janela.
export function freezeChoice(id: string, choice: ConversationChoice): void {
  apply(id, mergeChoice(choices.get(id), choice, true));
  emit();
  window.api.chat.choices.freeze(id, choice);
}

export function moveChoice(from: string, to: string): void {
  const saved = choices.get(from);
  if (!saved || from === to) return;
  choices.delete(from);
  apply(to, mergeChoice(choices.get(to), saved, false));
  emit();
  window.api.chat.choices.move(from, to);
}

// As versões antigas guardavam no armazenamento da janela (chat-account:<id>, chat-settings:<id>).
// Vão uma vez para o Argus que esta janela mostra, só onde ele não tem nada. A janela do acesso
// remoto guarda no armazenamento do notebook: as escolhas feitas nela vão para o de casa.
const LEGACY_ACCOUNT = 'chat-account:';
const LEGACY_SETTINGS = 'chat-settings:';
const seededKey = () => (REMOTE_HOST ? `chatChoicesSeeded:${REMOTE_HOST.name}:${REMOTE_HOST.homeDir}` : 'chatChoicesSeeded');

function legacyChoices(): Record<string, ConversationChoice> {
  const out: Record<string, ConversationChoice> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = key && localStorage.getItem(key);
    if (!key || !value) continue;
    if (key.startsWith(LEGACY_ACCOUNT)) {
      const id = key.slice(LEGACY_ACCOUNT.length);
      out[id] = { ...out[id], account: value };
    } else if (key.startsWith(LEGACY_SETTINGS)) {
      const id = key.slice(LEGACY_SETTINGS.length);
      try {
        out[id] = { ...out[id], settings: JSON.parse(value) as ConversationChoice['settings'] };
      } catch {
        // Gravação estragada: fica de fora.
      }
    }
  }
  return out;
}

function seedLegacy(): void {
  try {
    if (localStorage.getItem(seededKey())) return;
    const legacy = legacyChoices();
    if (Object.keys(legacy).length) window.api.chat.choices.seed(legacy);
    localStorage.setItem(seededKey(), '1');
  } catch {
    // Sem armazenamento, não há o que levar.
  }
}

// `?.`: o window.api falso dos testes não tem o campo.
const api = window.api.chat?.choices;
if (api) {
  api.onChanged((id, choice) => {
    apply(id, choice);
    emit();
  });
  void api.all().then((all) => {
    for (const [id, choice] of Object.entries(all)) apply(id, choice);
    emit();
    seedLegacy();
  });
}
