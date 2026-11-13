// Busca de texto da conversa: sem diferenciar maiúsculas nem acentos ("historico" acha
// "Histórico"). Cada letra vira a sua forma simples, guardando de onde ela veio no texto original,
// para o trecho achado voltar às posições de verdade (e ser destacado na tela).

// Texto simplificado e, para cada letra dele, a posição da letra original.
export type Folded = { text: string; origin: number[] };

const MARKS = /\p{M}/gu;

export function fold(text: string): Folded {
  let out = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    // Letra comum (a maioria): sem passar pelo normalize, que custa caro numa conversa inteira.
    const simple = c.charCodeAt(0) < 128 ? c.toLowerCase() : c.normalize('NFD').replace(MARKS, '').toLowerCase();
    for (let j = 0; j < simple.length; j++) {
      out += simple[j];
      origin.push(i);
    }
  }
  return { text: out, origin };
}

// Termo da busca na mesma forma simples; vazio quando só tem espaços.
export function foldQuery(query: string): string {
  return query.trim() ? fold(query).text : '';
}

// Trechos achados no texto original, como [início, fim) e sem sobrepor.
export function findMatches(text: string, query: string): [number, number][] {
  const needle = foldQuery(query);
  if (!needle) return [];
  const folded = fold(text);
  const found: [number, number][] = [];
  for (let at = folded.text.indexOf(needle); at >= 0; at = folded.text.indexOf(needle, at + needle.length)) {
    found.push([folded.origin[at], folded.origin[at + needle.length - 1] + 1]);
  }
  return found;
}

// Quantas vezes o termo (já simplificado) aparece no texto.
export function countMatches(text: string, needle: string): number {
  if (!needle) return 0;
  const hay = fold(text).text;
  let count = 0;
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) count++;
  return count;
}
