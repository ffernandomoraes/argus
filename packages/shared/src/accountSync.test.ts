import { describe, expect, it } from 'vitest';
import {
  afterPush,
  canonical,
  emptyMemory,
  localKey,
  markDirty,
  missingOnServer,
  normalizeMemory,
  pendingValues,
  planPull,
  readReport,
  rendererValues,
  serverKey,
} from './accountSync';

const item = (key: string, value: unknown) => ({ key: `pref.${key}`, value });

describe('chaves', () => {
  it('vão para o servidor com prefixo e voltam só as conhecidas', () => {
    expect(serverKey('theme')).toBe('pref.theme');
    expect(localKey('pref.language')).toBe('language');
    expect(localKey('pref.interfaceZoom')).toBeNull();
    expect(localKey('theme')).toBeNull();
  });

  it('canonical não depende da ordem das chaves', () => {
    expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 }));
    expect(canonical(undefined)).toBe('null');
  });
});

describe('planPull', () => {
  it('aplica o que veio e avança o cursor', () => {
    const r = planPull(emptyMemory(), [item('theme', 'light'), item('language', 'pt')], 7, false);
    expect(r.apply).toEqual({ theme: 'light', language: 'pt' });
    expect(r.memory.cursor).toBe(7);
    expect(r.memory.synced).toEqual({ theme: '"light"', language: '"pt"' });
  });

  it('a mudada aqui e ainda não enviada fica, fora da primeira entrada', () => {
    const memory = { ...emptyMemory(), dirty: ['theme' as const] };
    const r = planPull(memory, [item('theme', 'light')], 3, false);
    expect(r.apply).toEqual({});
    expect(r.memory.dirty).toEqual(['theme']);
  });

  it('na primeira entrada as da conta vencem até as mudadas aqui', () => {
    const memory = { ...emptyMemory(), dirty: ['theme' as const] };
    const r = planPull(memory, [item('theme', 'light')], 3, true);
    expect(r.apply).toEqual({ theme: 'light' });
    expect(r.memory.dirty).toEqual([]);
  });

  it('ignora preferência de outra versão do app e não volta o cursor', () => {
    const r = planPull({ ...emptyMemory(), cursor: 9 }, [item('futureThing', 1)], 4, false);
    expect(r.apply).toEqual({});
    expect(r.memory.cursor).toBe(9);
  });
});

describe('readReport', () => {
  it('a primeira contagem e as mudanças da janela são edições', () => {
    const first = readReport(emptyMemory(), { theme: 'dark', mediaPlayer: true });
    expect(first.edited).toEqual({ theme: 'dark', mediaPlayer: true });
    const again = readReport(first.memory, { theme: 'dark', mediaPlayer: false });
    expect(again.edited).toEqual({ mediaPlayer: false });
    expect(again.toApply).toEqual({});
  });

  it('valor da conta que chegou com a janela fechada vai para a janela', () => {
    const seen = readReport(emptyMemory(), { theme: 'dark' }).memory;
    const pulled = planPull(seen, [item('theme', 'light')], 2, false).memory;
    const r = readReport(pulled, { theme: 'dark' });
    expect(r.edited).toEqual({});
    expect(r.toApply).toEqual({ theme: 'light' });
  });

  it('a janela aplicando o valor da conta não vira pendente', () => {
    const seen = readReport(emptyMemory(), { theme: 'dark' }).memory;
    const pulled = planPull(seen, [item('theme', 'light')], 2, false).memory;
    const r = readReport(pulled, { theme: 'light' });
    expect(r.edited).toEqual({ theme: 'light' });
    expect(markDirty(r.memory, r.edited).dirty).toEqual([]);
  });

  it('não manda para a janela o que está pendente aqui', () => {
    const memory = { ...emptyMemory(), synced: { theme: '"light"' }, dirty: ['theme' as const], rendererSeen: { theme: '"dark"' } };
    expect(readReport(memory, { theme: 'dark' }).toApply).toEqual({});
  });
});

describe('envio', () => {
  it('pendentes vão com o valor de agora e saem depois de aceitos', () => {
    let memory = markDirty(emptyMemory(), { language: 'en', notifications: false });
    expect(new Set(memory.dirty)).toEqual(new Set(['language', 'notifications']));
    const current = { language: 'en', notifications: false };
    const sent = pendingValues(memory, current);
    expect(sent).toEqual(current);
    memory = afterPush(memory, sent, current);
    expect(memory.dirty).toEqual([]);
    expect(markDirty(memory, current).dirty).toEqual([]);
  });

  it('mudada de novo durante o envio continua pendente', () => {
    const memory = markDirty(emptyMemory(), { language: 'en' });
    const next = afterPush(memory, { language: 'en' }, { language: 'pt' });
    expect(next.dirty).toEqual(['language']);
    expect(next.synced.language).toBe('"en"');
  });

  it('as que a conta não tem saem do valor daqui', () => {
    const memory = { ...emptyMemory(), synced: { theme: '"light"' } };
    expect(missingOnServer(memory, { theme: 'dark', language: 'pt', notifications: undefined })).toEqual({ language: 'pt' });
  });
});

describe('normalizeMemory', () => {
  it('descarta o que não é do formato', () => {
    const m = normalizeMemory({ cursor: -1, synced: { theme: '"x"', zoom: '1', language: 3 }, dirty: ['theme', 'theme', 'zoom', 4], rendererSeen: { language: '"pt"', mediaPlayer: 'true' } });
    expect(m).toEqual({ cursor: 0, synced: { theme: '"x"' }, dirty: ['theme'], rendererSeen: { mediaPlayer: 'true' } });
    expect(normalizeMemory(null)).toEqual(emptyMemory());
  });

  it('rendererValues devolve os valores contados', () => {
    expect(rendererValues({ ...emptyMemory(), rendererSeen: { mediaPlayer: 'true', theme: '"dark"' } })).toEqual({ mediaPlayer: true, theme: 'dark' });
  });
});
