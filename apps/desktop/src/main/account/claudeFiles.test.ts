import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeHash, scanClaudeFiles, writeClaudeFile } from './claudeFiles';

// Leitura e gravação das instruções e skills dos agentes, numa pasta do usuário de mentira.

let home: string;
let oldHome: string | undefined;
let oldProfile: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'argus-claude-'));
  oldHome = process.env.HOME;
  oldProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  delete process.env.CODEX_HOME;
});

afterEach(() => {
  process.env.HOME = oldHome;
  process.env.USERPROFILE = oldProfile;
  rmSync(home, { recursive: true, force: true });
});

const put = (rel: string, content: string | Buffer, dir = '.claude') => {
  const path = join(home, dir, ...rel.split('/'));
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
};

describe('scanClaudeFiles', () => {
  it('reads the four areas, text only, without hidden or other files', async () => {
    put('CLAUDE.md', '# regras');
    put('skills/pdf/SKILL.md', 'skill');
    put('skills/pdf/scripts/run.py', 'print(1)');
    put('skills/pdf/logo.png', Buffer.from([0x89, 0x50, 0x00, 0x01]));
    put('skills/pdf/node_modules/x/index.js', 'x');
    put('skills/.hidden/SKILL.md', 'x');
    put('agents/reviewer.md', 'agent');
    put('commands/git/ship.md', 'cmd');
    put('settings.json', '{}');
    put('projects/a/b.jsonl', '{}');
    const files = await scanClaudeFiles();
    expect([...files.keys()]).toEqual(['CLAUDE.md', 'agents/reviewer.md', 'commands/git/ship.md', 'skills/pdf/SKILL.md', 'skills/pdf/scripts/run.py']);
    expect(files.get('CLAUDE.md')).toEqual({ content: '# regras', hash: claudeHash('# regras') });
  });

  it('leaves out keys, certificates and credentials', async () => {
    const key = ['-----BEGIN OPENSSH PRIVATE KEY-----', 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW', '-----END OPENSSH PRIVATE KEY-----'].join('\n');
    put('skills/deploy/SKILL.md', 'Para assinar, use a chave:\n-----BEGIN PRIVATE KEY-----\n<a sua chave aqui>\n-----END PRIVATE KEY-----');
    put('skills/deploy/cert.pem', 'x');
    put('skills/deploy/server.key', 'x');
    put('skills/deploy/prod.env', 'TOKEN=1');
    put('skills/deploy/id_ed25519', 'x');
    put('skills/deploy/credentials.json', '{}');
    put('skills/deploy/client_secret_123.json', '{}');
    put('skills/deploy/notes.txt', key);
    put('skills/deploy/sa.json', JSON.stringify({ private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\n-----END PRIVATE KEY-----\n' }));
    put('skills/deploy/env.ts', 'export const url = process.env.URL;');
    const files = await scanClaudeFiles();
    expect([...files.keys()]).toEqual(['skills/deploy/SKILL.md', 'skills/deploy/env.ts']);
  });

  it.skipIf(process.platform === 'win32')('follows a linked skill folder, not links inside it', async () => {
    const repo = join(home, 'repo-skill');
    mkdirSync(join(repo, 'inner'), { recursive: true });
    writeFileSync(join(repo, 'SKILL.md'), 'linked');
    writeFileSync(join(home, 'outside.md'), 'secret');
    symlinkSync(join(home, 'outside.md'), join(repo, 'inner', 'leak.md'));
    mkdirSync(join(home, '.claude', 'skills'), { recursive: true });
    symlinkSync(repo, join(home, '.claude', 'skills', 'mine'));
    const files = await scanClaudeFiles();
    expect([...files.keys()]).toEqual(['skills/mine/SKILL.md']);
  });

  it('skips files bigger than the limit', async () => {
    put('agents/big.md', 'x'.repeat(300 * 1024));
    expect((await scanClaudeFiles()).size).toBe(0);
  });
});

describe('other providers', () => {
  it('reads the instructions and areas of Codex, Gemini and Cursor, without their settings', async () => {
    put('AGENTS.md', 'codex', '.codex');
    put('skills/pdf/SKILL.md', 'skill', '.codex');
    put('config.toml', 'x', '.codex');
    put('GEMINI.md', 'gemini', '.gemini');
    put('commands/ship.toml', 'cmd', '.gemini');
    put('settings.json', '{}', '.gemini');
    put('commands/ship.md', 'cmd', '.cursor');
    put('mcp.json', '{}', '.cursor');
    const files = await scanClaudeFiles();
    expect([...files.keys()]).toEqual(['codex/AGENTS.md', 'codex/skills/pdf/SKILL.md', 'cursor/commands/ship.md', 'gemini/GEMINI.md', 'gemini/commands/ship.toml']);
  });

  it('writes each one in its own folder', async () => {
    await writeClaudeFile('codex/AGENTS.md', 'ok');
    expect(readFileSync(join(home, '.codex', 'AGENTS.md'), 'utf8')).toBe('ok');
    await writeClaudeFile('gemini/commands/git/ship.toml', 'ok');
    expect(readFileSync(join(home, '.gemini', 'commands', 'git', 'ship.toml'), 'utf8')).toBe('ok');
    await expect(writeClaudeFile('codex/config.toml', 'x')).rejects.toThrow();
  });
});

describe('writeClaudeFile', () => {
  it('writes inside ~/.claude and refuses anything else', async () => {
    await writeClaudeFile('skills/pdf/scripts/run.py', 'ok');
    expect(readFileSync(join(home, '.claude', 'skills', 'pdf', 'scripts', 'run.py'), 'utf8')).toBe('ok');
    await expect(writeClaudeFile('skills/../../evil.md', 'x')).rejects.toThrow();
    await expect(writeClaudeFile('settings.json', 'x')).rejects.toThrow();
  });
});
