import { scrubText } from '../errorReports/scrub';

// Diário do app: o que cada parte fez e decidiu, em linhas curtas, para explicar um erro depois. O
// Sentry recebe o retrato do momento do erro; o diário conta as horas antes. Vai anexado a cada
// relatório (ver errorReports/journalReport.ts) e fica gravado em ~/.argus/logs (journalFile.ts).
//
// Cada área guarda as suas linhas, com limite próprio: uma área barulhenta não apaga as outras. O
// rastro do Sentry, com uma lista só para tudo, perdia justamente o que explicaria o erro (ARGUS-K,
// 2026-11-18: 36 das 60 vagas eram o player falhando). Linha igual à anterior da mesma área vira
// contagem.
//
// O texto passa pela mesma limpeza dos relatórios (sem nome de usuário nem e-mail). Nunca entra o
// login, um token ou conteúdo de conversa: quem anota passa só estados, números e motivos.

export type JournalArea = 'login' | 'usage' | 'claude' | 'system' | 'remote' | 'slow' | 'update';

// O nome da área como aparece na linha.
const AREA_LABELS: Record<JournalArea, string> = {
  login: 'login',
  usage: 'uso',
  claude: 'claude',
  system: 'sistema',
  remote: 'remoto',
  slow: 'lento',
  update: 'atualização',
};

export type JournalData = Record<string, string | number | boolean | null | undefined>;

type Entry = { area: JournalArea; at: number; text: string; repeats: number; lastAt: number };

const PER_AREA = 300;
const KEEP_MS = 3 * 60 * 60_000;
// Repetida depois disso conta como linha nova (e mostra que voltou a acontecer).
const REPEAT_MS = 10 * 60_000;
const MAX_TEXT = 600;

const areas = new Map<JournalArea, Entry[]>();
let version = 0;
let writer: ((line: string) => void) | null = null;

// Quem grava as linhas no arquivo (journalFile.ts). A linha repetida não vai de novo: quando a
// sequência acaba, vai uma linha com a contagem.
export function setJournalWriter(write: ((line: string) => void) | null): void {
  writer = write;
}

// Muda a cada anotação: quem copia o diário para outro lugar só copia de novo quando ele mudou.
export const journalVersion = (): number => version;

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

function formatValue(value: string | number | boolean | null): string {
  return typeof value === 'string' && (value === '' || /\s|"/.test(value)) ? JSON.stringify(value) : String(value);
}

function formatData(data: JournalData): string {
  return Object.entries(data)
    .filter((pair): pair is [string, string | number | boolean | null] => pair[1] !== undefined)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ');
}

function formatEntry(e: Entry): string {
  const repeated = e.repeats ? ` (mais ${e.repeats}x até ${clock(e.lastAt)})` : '';
  return `${new Date(e.at).toISOString()} [${AREA_LABELS[e.area]}] ${e.text}${repeated}`;
}

const repeatLine = (e: Entry) =>
  `${new Date(e.lastAt).toISOString()} [${AREA_LABELS[e.area]}] (a linha de ${clock(e.at)} repetiu mais ${e.repeats}x)`;

function prune(list: Entry[], now: number): void {
  while (list.length > PER_AREA || (list.length && now - list[0].lastAt > KEEP_MS)) list.shift();
}

// Por garantia, além da limpeza dos relatórios: o que parecer chave ou token (o texto de erro de um
// programa pode trazer um) vira <segredo>. A impressão digital do login (8 letras) e os ids das contas
// são curtos e passam; caminhos de pasta também, porque a barra separa os pedaços.
export const hideSecrets = (text: string): string =>
  text.replace(/\bsk-ant-[\w-]+/g, '<segredo>').replace(/[A-Za-z0-9_\-+=.]{40,}/g, '<segredo>');

export function note(area: JournalArea, text: string, data?: JournalData, now = Date.now()): void {
  const extra = data ? formatData(data) : '';
  const clean = scrubText(hideSecrets(extra ? `${text} ${extra}` : text), MAX_TEXT);
  const list = areas.get(area) ?? [];
  const last = list.at(-1);
  version++;
  if (last && last.text === clean && now - last.lastAt < REPEAT_MS) {
    last.repeats++;
    last.lastAt = now;
    return;
  }
  if (last?.repeats) writer?.(repeatLine(last));
  const entry: Entry = { area, at: now, text: clean, repeats: 0, lastAt: now };
  list.push(entry);
  prune(list, now);
  areas.set(area, list);
  writer?.(formatEntry(entry));
}

// As contagens das sequências ainda abertas, para gravar antes de o app fechar.
export function pendingRepeatLines(): string[] {
  return [...areas.values()].flatMap((list) => {
    const last = list.at(-1);
    return last?.repeats ? [repeatLine(last)] : [];
  });
}

function linesSince(since: number): string[] {
  return [...areas.values()]
    .flat()
    .filter((e) => e.lastAt >= since)
    .sort((a, b) => a.at - b.at)
    .map(formatEntry);
}

// As linhas mais novas que cabem em `maxChars`, em ordem; as mais antigas saem primeiro.
function fit(lines: string[], maxChars: number): string {
  const kept: string[] = [];
  let size = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    size += lines[i].length + 1;
    if (size > maxChars) {
      kept.unshift('… (linhas mais antigas cortadas)');
      break;
    }
    kept.unshift(lines[i]);
  }
  return kept.join('\n');
}

// O diário das últimas `windowMs`, todas as áreas juntas, em ordem de hora.
export function journalText(windowMs: number, maxChars: number, now = Date.now()): string {
  return fit(linesSince(now - windowMs), maxChars);
}

// As últimas `maxLines` linhas, para o relatório de travamento do processo principal (que sai sem
// anexo; ver errorReports/journalReport.ts).
export function journalTail(maxLines: number, maxChars: number): string {
  return fit(linesSince(0).slice(-maxLines), maxChars);
}

// Para os testes.
export function clearJournal(): void {
  areas.clear();
  version = 0;
  writer = null;
}
