import { mergeChoice, type ConversationChoice } from '@argus/shared/chatChoices';
import { readJsonFile, writeJsonAtomic } from '../lib/jsonFile';

// Conta e modelo/esforço/modo de cada conversa (ver packages/shared/src/chatChoices.ts), num arquivo
// do Argus que roda a conversa. Toda janela (as daqui, a do acesso remoto) e o celular leem daqui.

// Só as mais recentes: as antigas (conversa apagada, nunca mais aberta) saem.
const MAX = 5000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// Só o que tem o formato certo: o arquivo e os pedidos vêm de fora (outro computador, versão antiga).
export function cleanChoice(value: unknown): ConversationChoice | null {
  if (!isRecord(value)) return null;
  const out: ConversationChoice = {};
  if (typeof value.account === 'string' && value.account) out.account = value.account;
  if (isRecord(value.settings)) {
    const s: Record<string, string | boolean> = {};
    for (const [k, v] of Object.entries(value.settings)) if (typeof v === 'string' || typeof v === 'boolean') s[k] = v;
    if (Object.keys(s).length) out.settings = s;
  }
  return out.account || out.settings ? out : null;
}

const same = (a: ConversationChoice | undefined, b: ConversationChoice | undefined) => JSON.stringify(a) === JSON.stringify(b);

export class ChatChoices {
  private choices = new Map<string, ConversationChoice>();

  constructor(
    private file: string,
    private onChange: (id: string, choice: ConversationChoice | null) => void,
  ) {
    const r = readJsonFile(file);
    if (r.status !== 'ok' || !isRecord(r.data)) return;
    for (const [id, value] of Object.entries(r.data)) {
      const choice = cleanChoice(value);
      if (choice) this.choices.set(id, choice);
    }
  }

  all(): Record<string, ConversationChoice> {
    return Object.fromEntries(this.choices);
  }

  get(id: string): ConversationChoice | undefined {
    return this.choices.get(id);
  }

  set(id: string, value: unknown): void {
    const choice = cleanChoice(value);
    if (choice) this.put(id, mergeChoice(this.choices.get(id), choice, false));
  }

  freeze(id: string, value: unknown): void {
    const choice = cleanChoice(value);
    if (choice) this.put(id, mergeChoice(this.choices.get(id), choice, true));
  }

  // Centenas de uma vez (a primeira abertura depois da atualização): uma gravação só.
  seed(values: unknown): void {
    if (!isRecord(values)) return;
    let changed = false;
    for (const [id, value] of Object.entries(values)) {
      const choice = cleanChoice(value);
      if (choice) changed = this.put(id, mergeChoice(this.choices.get(id), choice, true), false) || changed;
    }
    if (changed) this.save();
  }

  move(from: string, to: string): void {
    const saved = this.choices.get(from);
    if (!saved || from === to) return;
    this.choices.delete(from);
    this.onChange(from, null);
    this.save();
    this.put(to, mergeChoice(this.choices.get(to), saved, false));
  }

  private put(id: string, choice: ConversationChoice, save = true): boolean {
    const before = this.choices.get(id);
    if (same(before, choice)) return false;
    // A mexida agora vai para o fim: as que saem pelo limite são as esquecidas.
    this.choices.delete(id);
    this.choices.set(id, choice);
    for (const old of this.choices.keys()) {
      if (this.choices.size <= MAX) break;
      this.choices.delete(old);
    }
    this.onChange(id, choice);
    if (save) this.save();
    return true;
  }

  private save(): void {
    writeJsonAtomic(this.file, this.all()).catch((err: unknown) => console.error('[conversas] escolhas não gravadas:', err));
  }
}
