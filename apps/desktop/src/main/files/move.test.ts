import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Arrastar na árvore do painel de código, soltar arquivos do Finder e desfazer as alterações de um
// arquivo.

const trashed: string[] = [];
vi.mock('electron', () => ({ shell: { trashItem: async (p: string) => void trashed.push(p) }, clipboard: {}, ClipboardItem: class {} }));
vi.mock('../i18n', () => ({ tr: (pt: string) => pt }));

const { importPaths, moveItems } = await import('./move');
const { discardFile } = await import('../gitBranch/discard');

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'argus-move-'));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'src', 'a.ts'), 'A');
  trashed.length = 0;
});

afterEach(() => rm(root, { recursive: true, force: true }));

describe('moveItems', () => {
  it('move para a pasta e não sobrescreve', async () => {
    expect(await moveItems(root, ['src/a.ts'], 'docs')).toMatchObject({ ok: true });
    expect(existsSync(join(root, 'docs', 'a.ts'))).toBe(true);
    await writeFile(join(root, 'src', 'a.ts'), 'outro');
    expect((await moveItems(root, ['src/a.ts'], 'docs')).ok).toBe(false);
    expect(await readFile(join(root, 'docs', 'a.ts'), 'utf8')).toBe('A');
  });

  it('não move pasta para dentro dela nem para fora do projeto', async () => {
    await mkdir(join(root, 'src', 'sub'));
    expect((await moveItems(root, ['src'], 'src/sub')).ok).toBe(false);
    expect((await moveItems(root, ['src/a.ts'], '..')).ok).toBe(false);
    expect((await moveItems(root, [''], 'docs')).ok).toBe(false);
  });
});

describe('importPaths', () => {
  it('copia de fora do projeto, sem mexer no original', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'argus-drop-'));
    await writeFile(join(outside, 'solto.txt'), 'S');
    expect(await importPaths([join(outside, 'solto.txt')], root, 'docs')).toMatchObject({ ok: true, path: 'docs/solto.txt' });
    expect(existsSync(join(outside, 'solto.txt'))).toBe(true);
    await rm(outside, { recursive: true, force: true });
  });
});

describe('discardFile', () => {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });

  it('volta o arquivo ao último commit; o novo vai para a Lixeira', async () => {
    git('init', '-q');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x');
    await writeFile(join(root, 'src', 'a.ts'), 'mudado');
    expect(await discardFile(root, 'src/a.ts')).toMatchObject({ ok: true });
    expect(await readFile(join(root, 'src', 'a.ts'), 'utf8')).toBe('A');

    await writeFile(join(root, 'novo.ts'), 'N');
    git('add', 'novo.ts');
    expect(await discardFile(root, 'novo.ts')).toMatchObject({ ok: true });
    expect(trashed.map((p) => p.endsWith('novo.ts'))).toEqual([true]);
  });
});
