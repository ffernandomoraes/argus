import { afterEach, describe, expect, it } from 'vitest';
import { clearJournal, journalTail, journalText, note, pendingRepeatLines, setJournalWriter } from './journal';

// O diário do app: o que cada parte fez, para explicar um erro depois (ARGUS-K, 2026-11-18: o rastro
// do Sentry, uma lista só para tudo, perdeu o que explicaria a queda do login).

const lines = (text: string) => text.split('\n');

afterEach(() => clearJournal());

describe('diário', () => {
  it('junta as áreas em ordem de hora, com os dados de cada linha', () => {
    note('usage', 'leitura falhou: login', { account: 'main', httpStatus: 401, failures: 0, wsl: undefined }, 1000);
    note('login', 'login guardado mudou', { account: 'main', from: 'aaaa1111', to: null }, 2000);
    expect(lines(journalText(60_000, 10_000, 3000))).toEqual([
      '1970-01-01T00:00:01.000Z [uso] leitura falhou: login account=main httpStatus=401 failures=0',
      '1970-01-01T00:00:02.000Z [login] login guardado mudou account=main from=aaaa1111 to=null',
    ]);
  });

  it('texto com espaço vai entre aspas', () => {
    note('claude', 'saiu com 1', { stderr: 'OAuth refresh failed' }, 1000);
    expect(journalTail(5, 1000)).toContain('stderr="OAuth refresh failed"');
  });

  it('linha repetida vira contagem; o arquivo recebe a contagem quando a sequência acaba', () => {
    const written: string[] = [];
    setJournalWriter((l) => written.push(l));
    for (let i = 0; i < 36; i++) note('claude', 'uso saiu com 1', undefined, 1000 + i * 2000);
    expect(pendingRepeatLines()).toEqual(['1970-01-01T00:01:11.000Z [claude] (a linha de 00:00:01 repetiu mais 35x)']);
    note('claude', 'outra coisa', undefined, 100_000);
    expect(lines(journalText(10 * 60_000, 10_000, 100_000))).toEqual([
      '1970-01-01T00:00:01.000Z [claude] uso saiu com 1 (mais 35x até 00:01:11)',
      '1970-01-01T00:01:40.000Z [claude] outra coisa',
    ]);
    expect(written).toEqual([
      '1970-01-01T00:00:01.000Z [claude] uso saiu com 1',
      '1970-01-01T00:01:11.000Z [claude] (a linha de 00:00:01 repetiu mais 35x)',
      '1970-01-01T00:01:40.000Z [claude] outra coisa',
    ]);
  });

  it('a repetida depois de 10 minutos volta como linha nova', () => {
    note('system', 'computador acordou', undefined, 0);
    note('system', 'computador acordou', undefined, 11 * 60_000);
    expect(lines(journalText(60 * 60_000, 10_000, 12 * 60_000))).toHaveLength(2);
  });

  it('uma área barulhenta não apaga as outras', () => {
    note('login', 'conta perdeu o login', undefined, 1000);
    for (let i = 0; i < 1000; i++) note('slow', `operação ${i}`, undefined, 2000 + i);
    const text = journalText(60 * 60_000, 1_000_000, 10_000);
    expect(text).toContain('[login] conta perdeu o login');
    expect(lines(text)).toHaveLength(301);
  });

  it('linhas de mais de 3 horas saem', () => {
    note('remote', 'ligação caiu', undefined, 0);
    note('remote', 'religou', undefined, 4 * 60 * 60_000);
    expect(journalText(24 * 60 * 60_000, 10_000, 4 * 60 * 60_000)).not.toContain('ligação caiu');
  });

  it('tira e-mail e a pasta da pessoa', () => {
    note('claude', 'erro', { stderr: 'falhou para ana@example.com em /Users/ana/projeto' }, 1000);
    const text = journalTail(5, 1000);
    expect(text).not.toContain('ana@example.com');
    expect(text).not.toContain('/Users/ana/');
    expect(text).toContain('<email>');
  });

  it('esconde o que parece chave ou token', () => {
    note('claude', 'erro', { stderr: 'token sk-ant-oat01-abcDEF123 e eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc' }, 1000);
    const text = journalTail(5, 1000);
    expect(text).not.toContain('sk-ant-oat01');
    expect(text).not.toContain('eyJhbGci');
    expect(text).toContain('<segredo>');
  });

  it('não esconde caminho de pasta comprido', () => {
    note('claude', 'erro', { stderr: 'não achou /opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js' }, 1000);
    expect(journalTail(5, 1000)).toContain('@anthropic-ai/claude-code/cli.js');
  });

  it('cabe no tamanho pedido, ficando as linhas mais novas', () => {
    for (let i = 0; i < 20; i++) note('usage', `linha ${i}`, undefined, 1000 + i);
    const text = journalText(60_000, 200, 2000);
    expect(text.length).toBeLessThanOrEqual(240);
    expect(text).toContain('linha 19');
    expect(text).not.toContain('linha 0\n');
    expect(lines(text)[0]).toBe('… (linhas mais antigas cortadas)');
  });

  it('o fim do diário, em linhas', () => {
    for (let i = 0; i < 10; i++) note('usage', `linha ${i}`, undefined, 1000 + i);
    expect(lines(journalTail(3, 10_000)).map((l) => l.split('] ')[1])).toEqual(['linha 7', 'linha 8', 'linha 9']);
  });
});
