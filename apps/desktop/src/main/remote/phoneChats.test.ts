import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forgetPhoneChat, markPhoneChat, phoneDevicesOf, loadPhoneChats } from './phoneChats';

const until = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
};

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

  it('a lista volta depois de reiniciar o Argus, sem as conversas paradas há mais de 30 dias', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'phone-chats-')), 'phoneChats.json');
    loadPhoneChats(file);
    const now = Date.now();
    markPhoneChat('iphone', ['sessao-recente'], now);
    markPhoneChat('iphone', ['sessao-velha'], now - 31 * 24 * 3600 * 1000);
    await until(() => {
      try {
        return readFileSync(file, 'utf8').includes('sessao-velha');
      } catch {
        return false;
      }
    });
    loadPhoneChats(file, now);
    expect([...phoneDevicesOf(['sessao-recente'])]).toEqual(['iphone']);
    expect(phoneDevicesOf(['sessao-velha']).size).toBe(0);
  });
});
