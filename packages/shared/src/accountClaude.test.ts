import { describe, expect, it } from 'vitest';
import { claudeItemOf, filesOfItem, isAgentFilePath, planClaude } from './accountClaude';

describe('isAgentFilePath', () => {
  it('accepts the four areas only', () => {
    expect(isAgentFilePath('CLAUDE.md')).toBe(true);
    expect(isAgentFilePath('skills/pdf/SKILL.md')).toBe(true);
    expect(isAgentFilePath('skills/pdf/scripts/run.py')).toBe(true);
    expect(isAgentFilePath('agents/reviewer.md')).toBe(true);
    expect(isAgentFilePath('commands/git/ship.md')).toBe(true);
    expect(isAgentFilePath('settings.json')).toBe(false);
    expect(isAgentFilePath('skills/SKILL.md')).toBe(false);
    expect(isAgentFilePath('agents/x.txt')).toBe(false);
    expect(isAgentFilePath('skills/../settings.json')).toBe(false);
    expect(isAgentFilePath('skills/.hidden/a.md')).toBe(false);
    expect(isAgentFilePath('skills\\x\\a.md')).toBe(false);
    expect(isAgentFilePath('/etc/passwd')).toBe(false);
  });

  it('names the item of each file', () => {
    expect(claudeItemOf('skills/pdf/scripts/run.py')).toEqual({ key: 'skills/pdf', source: 'claude', kind: 'skill', name: 'pdf' });
    expect(claudeItemOf('commands/git/ship.md')).toEqual({ key: 'commands/git/ship.md', source: 'claude', kind: 'command', name: '/git:ship' });
    expect(claudeItemOf('agents/reviewer.md')).toMatchObject({ kind: 'agent', name: 'reviewer' });
  });
});

describe('planClaude', () => {
  it('uploads what is new or changed only here', () => {
    const p = planClaude({ 'CLAUDE.md': 'a2', 'agents/x.md': 'x' }, { 'CLAUDE.md': 'a1' }, { 'CLAUDE.md': 'a1' });
    expect(p.upload.sort()).toEqual(['CLAUDE.md', 'agents/x.md']);
    expect(p.known).toEqual({ 'CLAUDE.md': 'a2', 'agents/x.md': 'x' });
    expect(p.items.every((i) => i.status === 'synced')).toBe(true);
  });

  it('offers what came from another computer, never writing it', () => {
    const p = planClaude({ 'CLAUDE.md': 'a1' }, { 'CLAUDE.md': 'a2', 'skills/pdf/SKILL.md': 's', 'skills/pdf/run.py': 'r' }, { 'CLAUDE.md': 'a1' });
    expect(p.upload).toEqual([]);
    expect(p.items).toEqual([
      { key: 'CLAUDE.md', source: 'claude', kind: 'instructions', name: 'CLAUDE.md', status: 'updated', files: 1 },
      { key: 'skills/pdf', source: 'claude', kind: 'skill', name: 'pdf', status: 'new', files: 2 },
    ]);
  });

  it('marks a conflict when both sides changed (or on the first sign-in)', () => {
    expect(planClaude({ 'CLAUDE.md': 'b' }, { 'CLAUDE.md': 'c' }, { 'CLAUDE.md': 'a' }).items[0].status).toBe('conflict');
    expect(planClaude({ 'CLAUDE.md': 'b' }, { 'CLAUDE.md': 'c' }, {}).items[0].status).toBe('conflict');
  });

  it('respects a removal from the account and a deletion here', () => {
    const removedThere = planClaude({ 'agents/x.md': 'x' }, {}, { 'agents/x.md': 'x' });
    expect(removedThere.upload).toEqual([]);
    expect(removedThere.items).toEqual([]);
    const deletedHere = planClaude({}, { 'agents/x.md': 'x' }, { 'agents/x.md': 'x' });
    expect(deletedHere.items).toEqual([]);
    const newerThere = planClaude({}, { 'agents/x.md': 'y' }, { 'agents/x.md': 'x' });
    expect(newerThere.items[0].status).toBe('new');
  });

  it('finds the files of an item', () => {
    expect(filesOfItem('skills/pdf', ['skills/pdf/a', 'skills/pdfx/b', 'CLAUDE.md'])).toEqual(['skills/pdf/a']);
    expect(filesOfItem('CLAUDE.md', ['skills/pdf/a', 'CLAUDE.md'])).toEqual(['CLAUDE.md']);
  });
});

describe('other providers', () => {
  it('accepts only the instructions and areas of each one', () => {
    expect(isAgentFilePath('codex/AGENTS.md')).toBe(true);
    expect(isAgentFilePath('codex/skills/pdf/SKILL.md')).toBe(true);
    expect(isAgentFilePath('codex/config.toml')).toBe(false);
    expect(isAgentFilePath('codex/CLAUDE.md')).toBe(false);
    expect(isAgentFilePath('gemini/GEMINI.md')).toBe(true);
    expect(isAgentFilePath('gemini/commands/git/ship.toml')).toBe(true);
    expect(isAgentFilePath('gemini/commands/ship.md')).toBe(false);
    expect(isAgentFilePath('gemini/settings.json')).toBe(false);
    expect(isAgentFilePath('cursor/commands/ship.md')).toBe(true);
    expect(isAgentFilePath('cursor/skills/pdf/SKILL.md')).toBe(true);
    expect(isAgentFilePath('cursor/mcp.json')).toBe(false);
    expect(isAgentFilePath('cursor/AGENTS.md')).toBe(false);
  });

  it('groups by provider, with the provider in the key', () => {
    expect(claudeItemOf('codex/skills/pdf/scripts/run.py')).toEqual({ key: 'codex/skills/pdf', source: 'codex', kind: 'skill', name: 'pdf' });
    expect(claudeItemOf('gemini/commands/git/ship.toml')).toMatchObject({ source: 'gemini', kind: 'command', name: '/git:ship' });
    expect(claudeItemOf('gemini/GEMINI.md')).toMatchObject({ source: 'gemini', kind: 'instructions', name: 'GEMINI.md' });
    expect(filesOfItem('codex/skills/pdf', ['codex/skills/pdf/SKILL.md', 'codex/skills/pdfx/SKILL.md', 'skills/pdf/SKILL.md'])).toEqual(['codex/skills/pdf/SKILL.md']);
  });
});
