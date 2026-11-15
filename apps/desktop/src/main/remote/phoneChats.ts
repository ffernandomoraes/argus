import type { Page } from '../ipc/page';
import { readJsonFile, writeJsonAtomic } from '../lib/jsonFile';

// Conversas em que alguém mexeu pelo celular (mandou mensagem ou respondeu um pedido): só delas sai
// notificação, e só para o celular que mexeu. Conversando pelo desktop (ou pela janela de outro
// computador), a conversa volta a ser "do desktop" e para de notificar.
//
// Gravadas em disco (loadPhoneChats, na abertura do app): antes ficavam só na memória, e cada
// reinício do Argus (as atualizações automáticas, várias por dia) apagava a lista; as conversas
// começadas no celular paravam de notificar sem aviso. Sem arquivo configurado (testes), só memória.

// Conversa sem mexer pelo celular há mais que isto sai da lista, e a lista guarda no máximo MAX_CHATS.
const KEEP_MS = 30 * 24 * 3600 * 1000;
const MAX_CHATS = 500;

type Entry = { devices: Set<string>; at: number };
type Stored = Record<string, { devices: string[]; at: number }>;

const phonePages = new WeakSet<Page>();
// Chave da conversa (ou id da sessão) -> aparelhos que mexeram nela e quando foi a última vez.
const chats = new Map<string, Entry>();
let file: string | null = null;

export function loadPhoneChats(path: string, now = Date.now()): void {
  file = path;
  chats.clear();
  const read = readJsonFile<Stored>(path);
  if (read.status !== 'ok' || !read.data || typeof read.data !== 'object') return;
  for (const [key, v] of Object.entries(read.data)) {
    if (!v || !Array.isArray(v.devices) || typeof v.at !== 'number' || now - v.at > KEEP_MS) continue;
    const devices = v.devices.filter((d): d is string => typeof d === 'string');
    if (devices.length) chats.set(key, { devices: new Set(devices), at: v.at });
  }
}

function save(): void {
  if (!file) return;
  // As mais recentes primeiro; o resto sai.
  const kept = [...chats.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_CHATS);
  if (kept.length < chats.size) {
    chats.clear();
    for (const [key, entry] of kept) chats.set(key, entry);
  }
  const data: Stored = {};
  for (const [key, entry] of kept) data[key] = { devices: [...entry.devices], at: entry.at };
  writeJsonAtomic(file, data).catch((err: unknown) => console.error('[remoto web] conversas do celular não gravadas:', err));
}

export function registerPhonePage(page: Page): void {
  phonePages.add(page);
}

export const isPhonePage = (page: Page): boolean => phonePages.has(page);

export function markPhoneChat(deviceId: string, keys: (string | undefined)[], now = Date.now()): void {
  let changed = false;
  for (const key of keys) {
    if (!key) continue;
    const entry = chats.get(key);
    // A mesma conversa a cada mensagem: só grava de novo quando entra aparelho novo ou passou um dia.
    if (entry?.devices.has(deviceId) && now - entry.at < 24 * 3600 * 1000) continue;
    const devices = entry?.devices ?? new Set<string>();
    devices.add(deviceId);
    chats.set(key, { devices, at: now });
    changed = true;
  }
  if (changed) save();
}

export function forgetPhoneChat(keys: (string | undefined)[]): void {
  let changed = false;
  for (const key of keys) if (key && chats.delete(key)) changed = true;
  if (changed) save();
}

// Aparelhos que mexeram na conversa (pela chave ou pelo id da sessão).
export function phoneDevicesOf(keys: (string | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const key of keys) for (const d of (key && chats.get(key)?.devices) || []) out.add(d);
  return out;
}
