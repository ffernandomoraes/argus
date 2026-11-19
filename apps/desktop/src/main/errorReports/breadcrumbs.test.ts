import { afterEach, describe, expect, it } from 'vitest';
import { clearRepeats, collapseRepeats, labelHttp, repeatSummaries, repeatSummaryText } from './breadcrumbs';

// O rastro do Sentry tem uma lista só: a ação que se repete sem parar empurrava para fora o que
// explicaria o erro (ARGUS-K, 2026-11-18: 36 das 60 vagas eram o player falhando a cada 2 s).

const osascript = () => ({ category: 'child_process', message: "Child process exited with code '1'", data: { spawnfile: 'osascript' } });

afterEach(() => clearRepeats());

describe('ações repetidas no rastro', () => {
  it('entra 3 vezes; o resto vira uma contagem', () => {
    const kept = Array.from({ length: 36 }, (_, i) => collapseRepeats(osascript(), 1000 + i * 2000)).filter(Boolean);
    expect(kept).toHaveLength(3);
    expect(repeatSummaries()).toEqual([
      {
        timestamp: 71,
        category: 'repeated',
        level: 'info',
        message: 'child_process: "Child process exited with code \'1\'" repetiu mais 33x de 00:00:01 a 00:01:11',
        data: { spawnfile: 'osascript' },
      },
    ]);
    expect(repeatSummaryText()).toContain('repetiu mais 33x');
  });

  it('ações diferentes não se misturam', () => {
    for (let i = 0; i < 5; i++) expect(collapseRepeats({ category: 'ui', message: `clique ${i}` }, i)).not.toBeNull();
    expect(repeatSummaries()).toEqual([]);
  });

  it('depois de 10 minutos, a mesma ação volta a entrar, e a contagem anterior fica', () => {
    for (let i = 0; i < 5; i++) collapseRepeats(osascript(), i * 1000);
    expect(collapseRepeats(osascript(), 11 * 60_000)).not.toBeNull();
    expect(repeatSummaries().map((b) => b.message)).toEqual(['child_process: "Child process exited with code \'1\'" repetiu mais 2x de 00:00:00 a 00:00:04']);
  });
});

describe('nome das chamadas de rede', () => {
  it('dá nome às conhecidas e o endereço às outras', () => {
    const endpoint = (url: string) => labelHttp({ category: 'http', data: { url, status_code: 401 } }).data?.endpoint;
    expect(endpoint('https://api.anthropic.com/api/oauth/usage')).toBe('claude-usage');
    expect(endpoint('https://telemetry.argusterm.com/v1/report')).toBe('argus-telemetry');
    expect(endpoint('https://api.github.com/repos/ffernandomoraes/argus/releases/latest')).toBe('argus-update-check');
    expect(endpoint('https://registry.npmjs.org/@anthropic-ai/claude-code/latest')).toBe('claude-code-version');
    expect(endpoint('https://example.com/x?y=1')).toBe('example.com');
  });

  it('não mexe no que não é chamada de rede', () => {
    const b = { category: 'ui', data: { url: 'https://example.com' } };
    expect(labelHttp(b)).toBe(b);
  });
});
