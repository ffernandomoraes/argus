import { describe, expect, it } from 'vitest';
import type { HistoryPage, Message } from './history';
import { applyPatch, messageSignature, patchOf, type HistoryHave } from './historyPatch';
import { decodeWeb, encodeWeb } from './webRemote';

const msg = (id: string, text: string): Message => ({ id, role: 'assistant', text, at: '2026-11-14T10:00:00Z', tokens: undefined });
const page = (...messages: Message[]): HistoryPage => ({ messages, more: true });
const haveOf = (list: Message[]): HistoryHave => Object.fromEntries(list.map((m) => [m.id, messageSignature(m)]));

// A mensagem como o celular a recebe: pelo formato da ponte (encodeWeb/decodeWeb).
function overTheWire<T>(value: T): T {
  const m = decodeWeb(encodeWeb({ t: 'reply', id: 1, ok: true, value }));
  return m!.value as T;
}

describe('histórico só com o que mudou', () => {
  it('a assinatura de quem recebeu pela ponte bate com a do computador', () => {
    const original = msg('a', 'texto com acento, emoji 🎉 e "aspas"');
    expect(messageSignature(overTheWire(original))).toBe(messageSignature(original));
  });

  it('volta só as novas e as alteradas, com a ordem de todas', () => {
    const phone = [msg('a', 'um'), msg('b', 'dois')];
    const now = page(msg('a', 'um'), msg('b', 'dois, com o resultado da ferramenta'), msg('c', 'três'));
    const patch = patchOf(now, haveOf(phone));
    expect(patch.ids).toEqual(['a', 'b', 'c']);
    expect(patch.changed.map((m) => m.id)).toEqual(['b', 'c']);
    expect(applyPatch(overTheWire(patch), phone)).toEqual(overTheWire(now));
  });

  it('mantém os mesmos objetos das que não mudaram (a tela não redesenha)', () => {
    const phone = [msg('a', 'um'), msg('b', 'dois')];
    const result = applyPatch(patchOf(page(msg('a', 'um'), msg('b', 'dois')), haveOf(phone)), phone);
    expect(result?.messages[0]).toBe(phone[0]);
    expect(result?.messages[1]).toBe(phone[1]);
  });

  it('nula quando falta uma que o celular deveria ter', () => {
    expect(applyPatch({ ids: ['a', 'x'], changed: [], more: false }, [msg('a', 'um')])).toBeNull();
  });
});
