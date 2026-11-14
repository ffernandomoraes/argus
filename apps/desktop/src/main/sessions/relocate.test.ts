import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { projectDir } from '../transcripts/projectDir';
import { folderExists, relocateHistory } from './relocate';

// Pasta renomeada fora do Argus: o histórico e a memória do Claude Code vão junto para o nome novo.

let n = 0;
const home = () => process.env.HOME ?? '';
let from = '';
let to = '';

function write(dir: string, rel: string, text: string): void {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

beforeEach(() => {
  n++;
  from = join(home(), `old${n}`);
  to = join(home(), `new${n}`);
});

describe('folderExists', () => {
  it('pasta que existe, sim; caminho sumido, não', async () => {
    mkdirSync(to);
    expect(await folderExists(to)).toBe(true);
    expect(await folderExists(from)).toBe(false);
  });

  it('aceita o caminho com ~', async () => {
    mkdirSync(to);
    expect(await folderExists(`~/new${n}`)).toBe(true);
  });
});

describe('relocateHistory', () => {
  it('sem histórico na pasta antiga, não faz nada', async () => {
    expect(await relocateHistory(from, to)).toBeNull();
    expect(existsSync(projectDir(to))).toBe(false);
  });

  it('pasta nova sem histórico: o da antiga muda de nome inteiro', async () => {
    write(projectDir(from), 'a.jsonl', 'conversa');
    write(projectDir(from), 'memory/MEMORY.md', 'memória');
    expect(await relocateHistory(from, to)).toBeNull();
    expect(existsSync(projectDir(from))).toBe(false);
    expect(readFileSync(join(projectDir(to), 'a.jsonl'), 'utf8')).toBe('conversa');
    expect(readFileSync(join(projectDir(to), 'memory/MEMORY.md'), 'utf8')).toBe('memória');
  });

  it('pasta nova já com conversas: junta as duas sem sobrescrever', async () => {
    write(projectDir(from), 'a.jsonl', 'antiga');
    write(projectDir(from), 'memory/notes.md', 'nota');
    write(projectDir(to), 'b.jsonl', 'nova');
    write(projectDir(to), 'memory/MEMORY.md', 'índice novo');
    expect(await relocateHistory(from, to)).toBeNull();
    expect(existsSync(projectDir(from))).toBe(false);
    expect(readFileSync(join(projectDir(to), 'a.jsonl'), 'utf8')).toBe('antiga');
    expect(readFileSync(join(projectDir(to), 'b.jsonl'), 'utf8')).toBe('nova');
    expect(readFileSync(join(projectDir(to), 'memory/notes.md'), 'utf8')).toBe('nota');
  });

  it('arquivo com o mesmo nome nos dois lados: fica o da nova e o aviso diz onde está o antigo', async () => {
    write(projectDir(from), 'memory/MEMORY.md', 'antigo');
    write(projectDir(to), 'memory/MEMORY.md', 'novo');
    const warning = await relocateHistory(from, to);
    expect(warning).toContain(projectDir(from));
    expect(readFileSync(join(projectDir(to), 'memory/MEMORY.md'), 'utf8')).toBe('novo');
    expect(readFileSync(join(projectDir(from), 'memory/MEMORY.md'), 'utf8')).toBe('antigo');
  });

  it('mesma pasta dos dois lados: nada muda', async () => {
    write(projectDir(from), 'a.jsonl', 'x');
    expect(await relocateHistory(from, from)).toBeNull();
    expect(existsSync(join(projectDir(from), 'a.jsonl'))).toBe(true);
  });
});
