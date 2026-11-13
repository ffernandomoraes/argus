import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { projectDir } from '../transcripts/projectDir';
import { listSessions } from './list';
import { renameSessionFile } from './rename';

let n = 0;
const path = () => join(process.env.HOME ?? '', `rename${n}`);
const ID = '5e4479ab-a0be-4f15-8f49-a0c0e5f10ff4';
const file = () => join(projectDir(path()), `${ID}.jsonl`);
const user = JSON.stringify({ type: 'user', message: { role: 'user', content: 'arrumar o login' }, timestamp: '2026-11-11T10:00:00.000Z' });

beforeEach(() => {
  n++;
  mkdirSync(projectDir(path()), { recursive: true });
  writeFileSync(file(), `${user}\n`);
});

describe('renameSessionFile', () => {
  it('grava a linha do /rename no fim, e a lista passa a mostrar o nome', async () => {
    expect(await renameSessionFile(path(), ID, '  Login   novo \n')).toBeNull();
    const lines = readFileSync(file(), 'utf8').trimEnd().split('\n');
    expect(JSON.parse(lines.at(-1)!)).toEqual({ type: 'custom-title', customTitle: 'Login novo', sessionId: ID });
    expect((await listSessions(path()))?.find((s) => s.id === ID)?.title).toBe('Login novo');
  });

  it('arquivo cortado no meio de uma linha: a do nome entra numa linha própria', async () => {
    writeFileSync(file(), `${user}\n{"type":"assis`);
    expect(await renameSessionFile(path(), ID, 'Outro')).toBeNull();
    expect(readFileSync(file(), 'utf8').split('\n').at(-2)).toContain('"customTitle":"Outro"');
  });

  it('não cria conversa que não existe', async () => {
    expect(await renameSessionFile(path(), '11111111-2222-4333-8444-555555555555', 'X')).not.toBeNull();
  });

  it('recusa id que sairia da pasta e nome vazio', async () => {
    expect(await renameSessionFile(path(), '../../segredo', 'X')).toBe('Conversa inválida.');
    expect(await renameSessionFile(path(), ID, '   ')).toBe('O nome não pode ficar vazio.');
  });
});
