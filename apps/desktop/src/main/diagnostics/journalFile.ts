import { appendFileSync, mkdirSync } from 'node:fs';
import { appendFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import { DIR_NAME } from '../cli/locations';
import { pendingRepeatLines, setJournalWriter } from './journal';

// O diário (journal.ts) gravado em ~/.argus/logs, um arquivo por dia: dá para ler o que aconteceu numa
// máquina mesmo quando nada virou relatório. A gravação junta as linhas e escreve de tempos em tempos,
// fora do caminho do processo principal; só ao fechar o app ela espera a escrita. Erro ao gravar não
// atrapalha nada: o diário em memória segue igual.

const DAYS_KEPT = 7;
const FLUSH_MS = 2000;
const MAX_DAY_BYTES = 5 * 1024 * 1024;
const FILE_NAME = /^(\d{4}-\d{2}-\d{2})\.log$/;

export const logsDir = (): string => join(homedir(), DIR_NAME, 'logs');

// O dia local: é o que a pessoa procura ("ontem à noite").
function dayOf(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let queue: string[] = [];
let timer: NodeJS.Timeout | null = null;
let writing: Promise<void> = Promise.resolve();
let day = '';
let dayBytes = 0;
let warned = false;

function warnOnce(err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn('[diário] não deu para gravar em', logsDir(), (err as Error)?.message ?? err);
}

// Quanto o arquivo do dia já tem (o app reaberto no mesmo dia continua o arquivo).
async function startDay(name: string): Promise<void> {
  day = name;
  dayBytes = await stat(join(logsDir(), `${name}.log`)).then(
    (s) => s.size,
    () => 0,
  );
}

async function write(lines: string[], at: number): Promise<void> {
  const name = dayOf(at);
  if (name !== day) await startDay(name);
  if (dayBytes >= MAX_DAY_BYTES) return;
  let text = lines.map((l) => `${l}\n`).join('');
  if (dayBytes + Buffer.byteLength(text) >= MAX_DAY_BYTES) text += `${new Date(at).toISOString()} [diário] limite de 5 MB do dia; volta amanhã\n`;
  dayBytes += Buffer.byteLength(text);
  await mkdir(logsDir(), { recursive: true });
  await appendFile(join(logsDir(), `${name}.log`), text, 'utf8');
}

// Grava o que está na fila. As gravações vão uma depois da outra, na ordem.
export function flushJournalFile(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return writing;
  const lines = queue;
  queue = [];
  writing = writing.then(() => write(lines, Date.now())).catch(warnOnce);
  return writing;
}

// Ao fechar o app: o que está na fila e as contagens das linhas repetidas, de uma vez.
function flushNow(): void {
  const lines = [...queue, ...pendingRepeatLines()];
  queue = [];
  if (!lines.length || dayBytes >= MAX_DAY_BYTES) return;
  try {
    mkdirSync(logsDir(), { recursive: true });
    appendFileSync(join(logsDir(), `${dayOf(Date.now())}.log`), lines.map((l) => `${l}\n`).join(''), 'utf8');
  } catch (err) {
    warnOnce(err);
  }
}

// Apaga os arquivos com mais de DAYS_KEPT dias.
export async function removeOldLogs(now = Date.now()): Promise<void> {
  const names = await readdir(logsDir()).catch(() => [] as string[]);
  const oldest = dayOf(now - DAYS_KEPT * 24 * 60 * 60_000);
  await Promise.all(
    names
      .filter((n) => (FILE_NAME.exec(n)?.[1] ?? '9999') < oldest)
      .map((n) => rm(join(logsDir(), n), { force: true }).catch(() => undefined)),
  );
}

export function startJournalFile(): void {
  setJournalWriter((line) => {
    queue.push(line);
    if (!timer) {
      timer = setTimeout(() => void flushJournalFile(), FLUSH_MS);
      timer.unref();
    }
  });
  app.once('will-quit', flushNow);
  void removeOldLogs();
}

// Para os testes.
export function stopJournalFile(): void {
  setJournalWriter(null);
  if (timer) clearTimeout(timer);
  timer = null;
  queue = [];
  day = '';
  dayBytes = 0;
}
