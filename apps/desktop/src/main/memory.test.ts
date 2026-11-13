import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tela de memória com uma pasta do WSL. Desde 2026-11-12 o CLAUDE.md global do Windows vale nas
// pastas do WSL (o ~/.claude de lá ganha um link para ele, ver wsl/windowsConfig.ts): a tela não
// mostra mais um "Global (WSL)" à parte, nem grava nele por cima do link.

const fake = vi.hoisted(() => ({ usesWindows: true, forgot: 0, written: [] as string[] }));

vi.mock('./files/diskBase', () => ({ changedOnDisk: async () => false }));
vi.mock('./files/textFile', () => ({
  writeTextFile: async (path: string) => {
    fake.written.push(path);
  },
}));
vi.mock('./claudeHome', () => ({ claudeDir: (path?: string) => (path ? '/linux/.claude' : '/windows/.claude') }));
vi.mock('./paths', () => ({ expandHome: (p: string) => p }));
vi.mock('./sessions', () => ({ sessionsDir: (p: string) => `/sessions${p}` }));
vi.mock('./wsl', () => ({ distroFor: (path?: string) => (path?.startsWith('/wsl/') ? 'Ubuntu' : null) }));
vi.mock('./wsl/windowsConfig', () => ({
  usesWindowsItem: async () => fake.usesWindows,
  forgetWslConfig: () => {
    fake.forgot++;
  },
}));

import { listMemory, writeMemory } from './memory';

const projects = [{ name: 'p', path: '/wsl/Ubuntu/home/ana/p' }];
const globalsOf = async () => (await listMemory(projects)).filter((g) => !g.projectPath).map((g) => g.label);

beforeEach(() => {
  fake.usesWindows = true;
  fake.forgot = 0;
  fake.written = [];
});

describe('memória com pasta do WSL', () => {
  it('a pasta usa o CLAUDE.md do Windows: só o Global', async () => {
    expect(await globalsOf()).toEqual(['Global']);
  });

  it('o Linux tem o seu CLAUDE.md: ele aparece à parte, como antes', async () => {
    fake.usesWindows = false;
    expect(await globalsOf()).toEqual(['Global', 'Global (WSL: Ubuntu)']);
  });

  it('gravar o Global confere de novo as pastas do WSL; o do Linux ligado ao Windows não é gravado por cima', async () => {
    expect(await writeMemory('/windows/.claude/CLAUDE.md', 'texto', projects)).toBe(true);
    expect(fake.forgot).toBe(1);
    expect(await writeMemory('/linux/.claude/CLAUDE.md', 'texto', projects)).toBe(false);
    expect(fake.written).toEqual(['/windows/.claude/CLAUDE.md']);
  });
});
