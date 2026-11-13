import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// O status dos Claude Code do WSL na pergunta de fechar o app. A pasta de lá é de rede: ler na hora,
// síncrono, travava o app inteiro enquanto o WSL respondia. Vale a última leitura (a vigia das
// sessões relê a cada mudança), e a pergunta pede outra para a próxima vez.

const place = vi.hoisted(() => ({ dir: '' }));
// Leituras síncronas da pasta do WSL: não pode haver nenhuma.
const sync = vi.hoisted(() => ({ reads: 0 }));

vi.mock('./claudeHome', () => ({ statusDirsWithPlace: () => [{ dir: place.dir, distro: 'Ubuntu' }] }));
vi.mock('./wsl/pids', () => ({ wslPidAlive: () => true }));
vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs')>();
  const count =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      if (String(args[0]).startsWith(place.dir)) sync.reads++;
      return fn(...args);
    };
  return { ...real, readFileSync: count(real.readFileSync), readdirSync: count(real.readdirSync) };
});

import { lastWslStatusBySession, liveSessions } from './liveSessions';

const write = (pid: number, sessionId: string, status: string) =>
  writeFileSync(join(place.dir, `${pid}.json`), JSON.stringify({ pid, sessionId, status }));
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('lastWslStatusBySession', () => {
  it('responde a última leitura, sem ler a pasta do WSL na hora, e pede outra para a próxima vez', async () => {
    place.dir = join(mkdtempSync(join(homedir(), 'wsl-status-')), 'sessions');
    mkdirSync(place.dir);
    write(101, 'trabalhando', 'busy');
    // Antes de qualquer leitura: nada (a pergunta não espera o WSL).
    expect([...lastWslStatusBySession()]).toEqual([]);
    await flush();
    // A pergunta anterior pediu a leitura: agora a conversa aparece.
    expect([...lastWslStatusBySession()]).toEqual([['trabalhando', 'running']]);

    write(102, 'esperando', 'waiting');
    await liveSessions();
    expect(new Map(lastWslStatusBySession())).toEqual(
      new Map([
        ['trabalhando', 'running'],
        ['esperando', 'needs-you'],
      ]),
    );
    expect(sync.reads).toBe(0);
  });
});
