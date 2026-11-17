import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ChatChoices, cleanChoice } from './choices';

// Conta e modelo de cada conversa, guardados no Argus que roda a conversa. Antes cada janela
// guardava os seus: continuada na janela do acesso remoto, a conversa trocava de conta sozinha.

const fileIn = () => join(mkdtempSync(join(tmpdir(), 'choices-')), 'chatChoices.json');
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('escolhas das conversas', () => {
  it('troca vale por cima; primeiro envio e versões antigas só preenchem o que falta', () => {
    const changed = vi.fn();
    const c = new ChatChoices(fileIn(), changed);
    c.set('s1', { account: 'b', settings: { model: 'opus' } });
    c.freeze('s1', { account: 'grupo', settings: { model: '', effort: 'high' } });
    expect(c.get('s1')).toEqual({ account: 'b', settings: { model: 'opus', effort: 'high' } });
    c.seed({ s1: { account: 'velha' }, s2: { account: 'c' } });
    expect(c.get('s1')?.account).toBe('b');
    expect(c.get('s2')?.account).toBe('c');
    c.set('s1', { settings: { model: 'sonnet' } });
    expect(c.get('s1')).toEqual({ account: 'b', settings: { model: 'sonnet', effort: 'high' } });
    expect(changed).toHaveBeenLastCalledWith('s1', c.get('s1'));
  });

  it('conversa nova leva o escolhido para o id da sessão e avisa que o provisório saiu', () => {
    const changed = vi.fn();
    const c = new ChatChoices(fileIn(), changed);
    c.set('new-1', { account: 'b' });
    c.move('new-1', 's9');
    expect(c.get('new-1')).toBeUndefined();
    expect(c.get('s9')).toEqual({ account: 'b' });
    expect(changed).toHaveBeenCalledWith('new-1', null);
  });

  it('fica gravada para a próxima abertura, sem o que veio estragado', async () => {
    const file = fileIn();
    const c = new ChatChoices(file, () => undefined);
    c.set('s1', { account: 'b', settings: { model: 'opus' } });
    c.set('s2', { account: 42, settings: 'x' } as never);
    await settle();
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ s1: { account: 'b', settings: { model: 'opus' } } });
    expect(new ChatChoices(file, () => undefined).get('s1')).toEqual({ account: 'b', settings: { model: 'opus' } });
  });

  it('confere o formato do que chega de fora', () => {
    expect(cleanChoice(null)).toBeNull();
    expect(cleanChoice({ account: '' })).toBeNull();
    expect(cleanChoice({ settings: { model: 'x', bad: {} } })).toEqual({ settings: { model: 'x' } });
  });
});
