import type { TextSearchMatch, TextSearchOptions } from '@argus/shared/files';
import { tr } from '../i18n';

// Tamanho máximo do trecho mostrado de uma linha (arquivo minificado tem linha de megabytes).
const MAX_SNIPPET = 300;
// Contexto antes do primeiro achado, numa linha cortada.
const LEAD = 40;
// Achados marcados por linha.
const MAX_RANGES = 50;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// O termo buscado como expressão regular do JavaScript: marca os achados no trecho e faz a busca
// inteira quando a pasta não é repositório git. Expressão inválida: a mensagem para a pessoa.
export function searchPattern(query: string, opts: TextSearchOptions): RegExp | { error: string } {
  const source = opts.regex ? query : escapeRegExp(query);
  const wrapped = opts.wholeWord ? `\\b(?:${source})\\b` : source;
  try {
    return new RegExp(wrapped, opts.caseSensitive ? 'g' : 'gi');
  } catch (err) {
    return { error: tr(`Expressão regular inválida: ${(err as Error).message}`, `Invalid regular expression: ${(err as Error).message}`) };
  }
}

// Onde o termo aparece na linha, [início, fim). Achado vazio (^, $, a*) não trava o laço.
export function matchRanges(line: string, pattern: RegExp): [number, number][] {
  const ranges: [number, number][] = [];
  pattern.lastIndex = 0;
  for (let m = pattern.exec(line); m && ranges.length < MAX_RANGES; m = pattern.exec(line)) {
    if (m[0].length === 0) {
      pattern.lastIndex++;
      continue;
    }
    ranges.push([m.index, m.index + m[0].length]);
  }
  pattern.lastIndex = 0;
  return ranges;
}

// A linha como aparece nos resultados: sem o recuo e, se for longa, cortada em volta do primeiro
// achado (com "…" no corte). As posições dos achados acompanham o corte.
export function lineSnippet(lineNumber: number, raw: string, pattern: RegExp): TextSearchMatch {
  const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
  const ranges = matchRanges(line, pattern);
  const indent = line.length - line.trimStart().length;
  let start = indent;
  if (line.length - start > MAX_SNIPPET && ranges.length) start = Math.max(start, ranges[0][0] - LEAD);
  const end = Math.min(line.length, start + MAX_SNIPPET);
  const head = start > indent ? '…' : '';
  const tail = end < line.length ? '…' : '';
  const shift = head.length - start;
  return {
    line: lineNumber,
    text: head + line.slice(start, end) + tail,
    ranges: ranges
      .filter(([a, b]) => b > start && a < end)
      .map(([a, b]): [number, number] => [Math.max(a, start) + shift, Math.min(b, end) + shift]),
  };
}
