import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectDir } from '../transcripts/projectDir';
import { moveSession } from './move';

// "Mover para projeto": a conversa solta vai para a pasta de conversas do projeto.

const live = vi.hoisted(() => new Map<string, string>());
vi.mock('../liveSessions', () => ({ liveSessions: async () => live }));

let n = 0;
const home = () => process.env.HOME ?? '';
let from = '';
let to = '';
const free = () => true;

function write(dir: string, rel: string, text: string): void {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

beforeEach(() => {
  n++;
  live.clear();
  from = join(home(), `solta${n}`);
  to = join(home(), `projeto${n}`);
});

describe('moveSession', () => {
  it('leva o .jsonl e a pasta dos subagentes; o resto fica', async () => {
    write(projectDir(from), 's1.jsonl', 'conversa');
    write(projectDir(from), 's1/subagents/a.jsonl', 'sub');
    write(projectDir(from), 's2.jsonl', 'outra');
    expect(await moveSession(from, to, 's1', free)).toBeNull();
    expect(readFileSync(join(projectDir(to), 's1.jsonl'), 'utf8')).toBe('conversa');
    expect(readFileSync(join(projectDir(to), 's1/subagents/a.jsonl'), 'utf8')).toBe('sub');
    expect(existsSync(join(projectDir(from), 's1.jsonl'))).toBe(false);
    expect(existsSync(join(projectDir(from), 's2.jsonl'))).toBe(true);
  });

  it('recusa conversa rodando ou que a sessão daqui não larga', async () => {
    write(projectDir(from), 's1.jsonl', 'conversa');
    live.set('s1', 'running');
    expect(await moveSession(from, to, 's1', free)).toMatch(/andamento/);
    live.clear();
    expect(await moveSession(from, to, 's1', () => false)).toMatch(/andamento/);
    expect(existsSync(join(projectDir(from), 's1.jsonl'))).toBe(true);
  });

  it('não sobrescreve conversa com o mesmo id no projeto', async () => {
    write(projectDir(from), 's1.jsonl', 'conversa');
    write(projectDir(to), 's1.jsonl', 'já estava');
    expect(await moveSession(from, to, 's1', free)).toMatch(/mesmo id/);
    expect(readFileSync(join(projectDir(to), 's1.jsonl'), 'utf8')).toBe('já estava');
  });

  it('id com caminho e conversa sem arquivo são recusados', async () => {
    expect(await moveSession(from, to, '../x', free)).toMatch(/inválida/);
    expect(await moveSession(from, to, 's9', free)).toMatch(/não foi encontrado/);
  });
});
