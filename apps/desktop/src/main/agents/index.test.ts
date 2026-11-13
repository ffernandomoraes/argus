import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentDef } from '@argus/shared/agents';

// A biblioteca de agentes numa pasta do WSL. Desde 2026-11-12 os agents globais do Windows valem nas
// pastas do WSL (ver wsl/windowsConfig.ts): a lista mostra os de lá, onde o Argus grava. Antes ela
// lia os do Linux e gravava no Windows.

const fake = vi.hoisted(() => ({ usesWindows: true, forgot: 0 }));

const agent = (name: string, path: string): AgentDef => ({ name, description: 'd', prompt: 'p', scope: 'global', path });

vi.mock('node:fs/promises', () => ({ mkdir: async () => undefined, rename: async () => undefined, unlink: async () => undefined }));
vi.mock('../files/fsHelpers', () => ({ exists: async () => false }));
vi.mock('../files/names', () => ({ isReservedOnWindows: () => false }));
vi.mock('../files/textFile', () => ({ writeTextFile: async () => undefined }));
vi.mock('../i18n', () => ({ tr: (pt: string) => pt }));
vi.mock('./format', () => ({ serializeAgent: () => 'x', serializeCodexAgent: () => 'x' }));
vi.mock('./folder', () => ({
  // Sem pasta, a do app (Windows); com a de um projeto do WSL, a do Linux.
  globalDir: (provider: string, path?: string) => (path ? `/linux/${provider}` : `/windows/${provider}`),
  projectDir: (provider: string, path: string) => `${path}/.${provider}/agents`,
  agentExt: () => '.md',
  findByName: (agents: AgentDef[], name: string) => agents.find((a) => a.name === name),
  readDir: async (_provider: string, dir: string) =>
    dir === '/windows/claude' ? [agent('do-windows', '/windows/claude/do-windows.md')] : dir === '/linux/claude' ? [agent('do-linux', '/linux/claude/do-linux.md')] : [],
}));
vi.mock('../wsl/windowsConfig', () => ({
  usesWindowsItem: async () => fake.usesWindows,
  forgetWslConfig: () => {
    fake.forgot++;
  },
}));

import { listAgents, saveAgent } from './index';

const WSL = '\\\\wsl.localhost\\Ubuntu\\home\\ana\\p';
const names = async () => (await listAgents('claude', WSL)).map((a) => a.name);

beforeEach(() => {
  fake.usesWindows = true;
  fake.forgot = 0;
});

describe('agentes numa pasta do WSL', () => {
  it('a pasta usa os agents do Windows: a lista mostra os de lá', async () => {
    expect(await names()).toEqual(['do-windows']);
  });

  it('o Linux tem a sua pasta de agents: mostra a dele, como antes', async () => {
    fake.usesWindows = false;
    expect(await names()).toEqual(['do-linux']);
  });

  it('salvar um agente do Claude confere de novo as pastas do WSL', async () => {
    const saved = await saveAgent('claude', { name: 'novo', description: 'quando usar', prompt: 'instruções' });
    expect(saved.ok).toBe(true);
    expect(fake.forgot).toBe(1);
    await saveAgent('codex', { name: 'outro', description: 'quando usar', prompt: 'instruções' });
    expect(fake.forgot).toBe(1);
  });
});
