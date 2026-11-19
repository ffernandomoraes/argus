import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearJournal, note } from './journal';
import { flushJournalFile, logsDir, removeOldLogs, startJournalFile, stopJournalFile } from './journalFile';

// O diário gravado em ~/.argus/logs (aqui, na pasta pessoal falsa dos testes), um arquivo por dia.

afterEach(() => {
  stopJournalFile();
  clearJournal();
});

describe('diário em arquivo', () => {
  it('grava as linhas no arquivo do dia', async () => {
    startJournalFile();
    note('system', 'computador acordou');
    note('remote', 'ligação caiu', { windows: 1 });
    await flushJournalFile();
    const files = (await readdir(logsDir())).filter((f) => f.endsWith('.log'));
    expect(files).toHaveLength(1);
    const text = await readFile(join(logsDir(), files[0]), 'utf8');
    expect(text).toContain('[sistema] computador acordou\n');
    expect(text).toContain('[remoto] ligação caiu windows=1\n');
  });

  it('apaga os arquivos com mais de 7 dias e deixa o resto', async () => {
    await mkdir(logsDir(), { recursive: true });
    for (const name of ['2026-11-01.log', '2026-11-12.log', '2026-11-18.log', 'outro.txt']) await writeFile(join(logsDir(), name), 'x');
    await removeOldLogs(new Date(2026, 10, 19, 12).getTime());
    const names = await readdir(logsDir());
    expect(names).not.toContain('2026-11-01.log');
    expect(names).toEqual(expect.arrayContaining(['2026-11-12.log', '2026-11-18.log', 'outro.txt']));
  });
});
