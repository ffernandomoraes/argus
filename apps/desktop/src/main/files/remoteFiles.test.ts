import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Arquivos pela janela de acesso remoto: copiar e colar entre pastas de lá, e o anexo mandado do
// notebook.

vi.mock('electron', () => ({ clipboard: {}, ClipboardItem: class {} }));
vi.mock('../winProcesses', () => ({ powershell: vi.fn() }));
vi.mock('../i18n', () => ({ tr: (pt: string) => pt }));

const { copyInto } = await import('./clipboard');
const { safeName, saveUpload } = await import('./upload');

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'argus-remote-files-'));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'dest'));
  await writeFile(join(root, 'src', 'a.txt'), 'A');
});

afterEach(() => rm(root, { recursive: true, force: true }));

describe('copyInto', () => {
  it('copia para a pasta e não sobrescreve: o repetido ganha "cópia"', async () => {
    expect(await copyInto(root, ['src/a.txt'], root, 'dest')).toMatchObject({ ok: true, path: 'dest/a.txt' });
    const again = await copyInto(root, ['src/a.txt'], root, 'dest');
    expect(again.ok).toBe(true);
    expect(again.ok && again.path).not.toBe('dest/a.txt');
    expect(await readFile(join(root, 'dest', 'a.txt'), 'utf8')).toBe('A');
  });

  it('não sai da pasta do projeto', async () => {
    expect((await copyInto(root, ['../fora.txt'], root, 'dest')).ok).toBe(false);
    expect((await copyInto(root, ['src/a.txt'], root, '../fora')).ok).toBe(false);
  });

  it('pasta dentro dela mesma é recusada', async () => {
    expect((await copyInto(root, ['src'], root, 'src')).ok).toBe(false);
  });
});

describe('anexo pelo acesso remoto', () => {
  it('fica numa pasta temporária, com o nome original', async () => {
    const res = await saveUpload('relatório.pdf', new TextEncoder().encode('conteúdo'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.path.endsWith('relatório.pdf')).toBe(true);
    expect(await readFile(res.path, 'utf8')).toBe('conteúdo');
    await rm(join(res.path, '..'), { recursive: true, force: true });
  });

  it('o nome não escolhe pasta nem usa caracteres que o Windows recusa', () => {
    expect(safeName('../../etc/passwd')).toBe('passwd');
    expect(safeName('C:\\x\\a:b?.txt')).toBe('a_b_.txt');
    expect(safeName('.bashrc')).toBe('bashrc');
    expect(safeName('..')).toBe('arquivo');
  });
});
