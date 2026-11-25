import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashOf, isAgentFilePath } from '../src/modules/claude/claude.rules';
import { createTestContext, type TestContext } from './helpers';

// Arquivos do Claude na conta: gravar, listar com o hash, ler, tirar e os limites.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

describe('arquivos do Claude', () => {
  it('grava, lista com o hash, lê e tira da conta', async () => {
    const { token } = await ctx.signedIn('claude@teste.com');
    const api = ctx.as(token);
    expect((await api.get('/api/claude')).body).toEqual({ files: [] });

    const files = [
      { path: 'CLAUDE.md', content: '# Regras\n' },
      { path: 'skills/pdf/SKILL.md', content: 'skill ção' },
    ];
    expect((await api.put('/api/claude', { files })).status).toBe(204);
    const list = (await api.get('/api/claude')).body.files;
    expect(list.map((f: { path: string; hash: string; size: number }) => [f.path, f.hash, f.size])).toEqual([
      ['CLAUDE.md', hashOf('# Regras\n'), 9],
      ['skills/pdf/SKILL.md', hashOf('skill ção'), 11],
    ]);

    const read = await api.post('/api/claude/read', { paths: ['skills/pdf/SKILL.md'] });
    expect(read.body).toEqual({ files: [{ path: 'skills/pdf/SKILL.md', content: 'skill ção' }] });

    await api.put('/api/claude', { files: [{ path: 'CLAUDE.md', content: 'novo' }] });
    expect((await api.get('/api/claude')).body.files[0].hash).toBe(hashOf('novo'));

    expect((await api.post('/api/claude/remove', { paths: ['CLAUDE.md'] })).status).toBe(204);
    expect((await api.get('/api/claude')).body.files.map((f: { path: string }) => f.path)).toEqual(['skills/pdf/SKILL.md']);
  });

  it('cada pessoa vê só os dela', async () => {
    const a = await ctx.signedIn('ca@teste.com');
    const b = await ctx.signedIn('cb@teste.com');
    await ctx.as(a.token).put('/api/claude', { files: [{ path: 'CLAUDE.md', content: 'a' }] });
    expect((await ctx.as(b.token).get('/api/claude')).body).toEqual({ files: [] });
    expect((await ctx.as(b.token).post('/api/claude/read', { paths: ['CLAUDE.md'] })).body).toEqual({ files: [] });
  });

  it('recusa caminho fora das áreas, binário, grande demais e sem login', async () => {
    const { token } = await ctx.signedIn('cbad@teste.com');
    const api = ctx.as(token);
    expect((await api.put('/api/claude', { files: [{ path: 'settings.json', content: '{}' }] })).status).toBe(400);
    expect((await api.put('/api/claude', { files: [{ path: 'skills/../x.md', content: 'x' }] })).status).toBe(400);
    expect((await api.put('/api/claude', { files: [{ path: 'agents/a.md', content: 'a\u0000b' }] })).status).toBe(400);
    expect((await api.put('/api/claude', { files: [{ path: 'agents/a.md', content: 'x'.repeat(300 * 1024) }] })).status).toBe(413);
    expect((await api.post('/api/claude/read', { paths: ['../etc/passwd'] })).status).toBe(400);
    expect((await ctx.as(null).get('/api/claude')).status).toBe(401);
  });

  it('para no limite de tamanho da conta', async () => {
    const { token } = await ctx.signedIn('climit@teste.com');
    const api = ctx.as(token);
    const chunk = 'x'.repeat(250 * 1024);
    // 8 envios de 5 arquivos de 250 KB = ~9,8 MB: cabe. O próximo passa de 10 MB.
    for (let i = 0; i < 8; i++) {
      const files = Array.from({ length: 5 }, (_, j) => ({ path: `skills/s${i}/f${j}.md`, content: chunk }));
      expect((await api.put('/api/claude', { files })).status).toBe(204);
    }
    expect((await api.put('/api/claude', { files: [{ path: 'skills/z/a.md', content: chunk }] })).status).toBe(413);
    // Trocar um que já existe pelo mesmo tamanho continua cabendo.
    expect((await api.put('/api/claude', { files: [{ path: 'skills/s0/f0.md', content: chunk.replace('x', 'y') }] })).status).toBe(204);
  });

  it('confere os caminhos como o app', () => {
    expect(isAgentFilePath('commands/git/ship.md')).toBe(true);
    expect(isAgentFilePath('skills/x')).toBe(false);
    expect(isAgentFilePath('skills/.git/config')).toBe(false);
    expect(isAgentFilePath('codex/AGENTS.md')).toBe(true);
    expect(isAgentFilePath('codex/config.toml')).toBe(false);
    expect(isAgentFilePath('gemini/commands/ship.toml')).toBe(true);
    expect(isAgentFilePath('gemini/settings.json')).toBe(false);
    expect(isAgentFilePath('cursor/skills/pdf/SKILL.md')).toBe(true);
    expect(isAgentFilePath('cursor/mcp.json')).toBe(false);
  });
});
