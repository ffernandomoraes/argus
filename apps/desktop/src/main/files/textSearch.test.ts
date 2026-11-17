import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Busca do painel de código: o padrão, o trecho mostrado e a busca com e sem git.

vi.mock('../i18n', () => ({ tr: (pt: string) => pt }));

const { lineSnippet, searchPattern } = await import('./searchPattern');
const { searchText } = await import('./textSearch');
const { listFileNames } = await import('./fileNames');

const opts = { caseSensitive: false, wholeWord: false, regex: false };

describe('searchPattern', () => {
  it('texto exato não vira expressão regular', () => {
    const p = searchPattern('a.b(', opts) as RegExp;
    expect(p.test('xa.b(y')).toBe(true);
    p.lastIndex = 0;
    expect(p.test('axb(')).toBe(false);
  });

  it('palavra inteira e maiúsculas', () => {
    const p = searchPattern('foo', { ...opts, wholeWord: true, caseSensitive: true }) as RegExp;
    expect(p.test('a foo b')).toBe(true);
    p.lastIndex = 0;
    expect(p.test('foobar')).toBe(false);
    p.lastIndex = 0;
    expect(p.test('FOO')).toBe(false);
  });

  it('expressão inválida volta como erro', () => {
    expect(searchPattern('(', { ...opts, regex: true })).toHaveProperty('error');
  });
});

describe('lineSnippet', () => {
  it('tira o recuo e acompanha as posições', () => {
    const s = lineSnippet(3, '    const foo = foo;\r', searchPattern('foo', opts) as RegExp);
    expect(s).toEqual({ line: 3, text: 'const foo = foo;', ranges: [[6, 9], [12, 15]] });
  });

  it('linha longa vem cortada em volta do achado', () => {
    const line = 'x'.repeat(1000) + 'ALVO' + 'y'.repeat(1000);
    const s = lineSnippet(1, line, searchPattern('alvo', opts) as RegExp);
    expect(s.text.startsWith('…')).toBe(true);
    expect(s.text.endsWith('…')).toBe(true);
    const [[a, b]] = s.ranges;
    expect(s.text.slice(a, b)).toBe('ALVO');
  });

  it('achado vazio não trava', () => {
    expect(lineSnippet(1, 'abc', searchPattern('x*', { ...opts, regex: true }) as RegExp).ranges).toEqual([]);
  });
});

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'argus-search-'));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'node_modules'));
  await writeFile(join(root, 'src', 'a.ts'), 'const alvo = 1;\nnada\n// Alvo de novo\n');
  await writeFile(join(root, 'src', 'b.txt'), 'sem nada\n');
  await writeFile(join(root, 'node_modules', 'dep.js'), 'alvo\n');
  await writeFile(join(root, 'bin.dat'), Buffer.from([0, 1, 2, 97, 108, 118, 111]));
});

afterEach(() => rm(root, { recursive: true, force: true }));

const gitInit = () => {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  writeFileSync(join(root, '.gitignore'), 'node_modules\n');
  git('add', 'src/a.ts');
};

describe('searchText', () => {
  it('fora do git: lê os arquivos e pula node_modules e binários', async () => {
    const res = await searchText({}, root, 'alvo', opts);
    expect(res).toMatchObject({ ok: true, total: 2, truncated: false });
    expect(res.ok && res.files.map((f) => [f.path, f.matches.map((m) => m.line)])).toEqual([['src/a.ts', [1, 3]]]);
  });

  it('no git: respeita o .gitignore e acha arquivo novo', async () => {
    gitInit();
    await writeFile(join(root, 'novo.md'), 'um alvo aqui\n');
    const res = await searchText({}, root, 'alvo', { ...opts, caseSensitive: true });
    expect(res.ok && res.files.map((f) => f.path).sort()).toEqual(['novo.md', 'src/a.ts']);
    expect(res.ok && res.total).toBe(2);
  });

  it('expressão regular no git', async () => {
    gitInit();
    const res = await searchText({}, root, 'al\\w+\\s=', { ...opts, regex: true });
    expect(res.ok && res.files[0].matches[0]).toMatchObject({ line: 1, ranges: [[6, 12]] });
  });

  it('busca nova da mesma janela cancela a anterior', async () => {
    const owner = {};
    const first = searchText(owner, root, 'alvo', opts);
    const second = searchText(owner, root, 'nada', opts);
    expect(await first).toMatchObject({ ok: false, cancelled: true });
    expect(await second).toMatchObject({ ok: true, total: 2 });
  });
});

describe('listFileNames', () => {
  it('no git: sem o que o .gitignore esconde', async () => {
    gitInit();
    const { files } = await listFileNames(root);
    expect(files.sort()).toEqual(['.gitignore', 'bin.dat', 'src/a.ts', 'src/b.txt']);
  });

  it('fora do git: percorre a pasta sem node_modules', async () => {
    const { files } = await listFileNames(root);
    expect(files.sort()).toEqual(['bin.dat', 'src/a.ts', 'src/b.txt']);
  });
});
