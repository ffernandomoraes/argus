import { describe, expect, it } from 'vitest';
import { githubHttpsUrl, isGitHubPage, readInstallations, readRepos } from './accountGitHub';

describe('githubHttpsUrl', () => {
  it('turns any github.com address into the https one', () => {
    expect(githubHttpsUrl('git@github.com:ana/argus.git')).toBe('https://github.com/ana/argus.git');
    expect(githubHttpsUrl('ssh://git@github.com/ana/argus')).toBe('https://github.com/ana/argus.git');
    expect(githubHttpsUrl('https://github.com/ana/argus')).toBe('https://github.com/ana/argus.git');
    expect(githubHttpsUrl('https://user@github.com/ana/my.repo.git')).toBe('https://github.com/ana/my.repo.git');
  });

  it('refuses other hosts and odd paths', () => {
    expect(githubHttpsUrl('https://gitlab.com/ana/argus.git')).toBeNull();
    expect(githubHttpsUrl('https://github.com.evil.com/ana/argus.git')).toBeNull();
    expect(githubHttpsUrl('https://github.com/ana/argus/tree/main')).toBeNull();
  });
});

describe('readRepos', () => {
  it('keeps only valid repositories', () => {
    const ok = { fullName: 'ana/argus', name: 'argus', owner: 'ana', private: true, description: null, pushedAt: 1, cloneUrl: 'https://github.com/ana/argus.git' };
    expect(readRepos([ok, { fullName: 'x' }, { ...ok, cloneUrl: 'https://evil.com/x.git' }])).toEqual([ok]);
    expect(readRepos('nope')).toEqual([]);
  });

  it('drops a repository whose address is not the one of its name, and strips credentials', () => {
    const ok = { fullName: 'ana/argus', name: 'argus', owner: 'ana', private: false, description: null, pushedAt: null, cloneUrl: 'https://github.com/ana/argus.git' };
    expect(readRepos([{ ...ok, cloneUrl: 'https://github.com/evil/argus.git' }])).toEqual([]);
    expect(readRepos([{ ...ok, fullName: 'ana/argus/x' }])).toEqual([]);
    expect(readRepos([{ ...ok, cloneUrl: 'https://GitHub.com/Ana/Argus' }])).toEqual([{ ...ok, cloneUrl: 'https://github.com/Ana/Argus.git' }]);
    expect(readRepos([{ ...ok, cloneUrl: 'https://someone:token@github.com/ana/argus.git' }])).toEqual([ok]);
  });
});

describe('isGitHubPage', () => {
  it('accepts only https pages of github.com', () => {
    expect(isGitHubPage('https://github.com/apps/argus-term/installations/new')).toBe(true);
    expect(isGitHubPage('https://github.com.evil.dev/x')).toBe(false);
    expect(isGitHubPage('https://user@github.com/x')).toBe(false);
    expect(isGitHubPage('http://github.com/x')).toBe(false);
    expect(isGitHubPage('ms-msdt:/id')).toBe(false);
    expect(readInstallations([{ id: 1, account: 'ana', manageUrl: 'file:///x' }])).toEqual([]);
  });
});
