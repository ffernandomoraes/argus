import { describe, expect, it } from 'vitest';
import { forgetPhoneChat, markPhoneChat, phoneDevicesOf } from './phoneChats';

describe('conversas tocadas pelo celular', () => {
  it('só avisa quem mexeu, pela chave ou pela sessão, até a conversa voltar ao desktop', () => {
    markPhoneChat('iphone', ['new-1', undefined]);
    markPhoneChat('ipad', ['sessao-2']);
    expect([...phoneDevicesOf(['new-1', 'sessao-1'])]).toEqual(['iphone']);
    expect([...phoneDevicesOf(['outra', 'sessao-2'])]).toEqual(['ipad']);
    expect(phoneDevicesOf(['nunca']).size).toBe(0);
    forgetPhoneChat(['new-1', 'sessao-1']);
    expect(phoneDevicesOf(['new-1']).size).toBe(0);
  });
});
