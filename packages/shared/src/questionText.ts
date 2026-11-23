// O Claude costuma escrever listas numeradas dentro da pergunta numa linha só
// ("é este? 1) preenche → 2) vira tarefa → 3) ..."). Aqui a lista é separada em itens para a
// interface mostrar um por linha. Devolve null quando não há lista (pelo menos 1 e 2 em sequência).

export type QuestionParts = { intro: string; items: string[]; outro: string };

// "1)" ou "1." no começo do texto ou depois de espaço, seguido de espaço (evita "1.5" e "v1.2").
const MARKER = /(^|\s)(\d{1,2})[.)]\s+/g;
// Separadores entre itens que sobram no fim de cada um: seta, vírgula, ponto e vírgula, "e".
const TRAILING_SEPARATOR = /\s*(?:→|->|=>|,|;|\s+e|\s+and)\s*$/i;
// Fim de frase seguido de outra frase: o que vem depois do último item é comentário, não item.
const SENTENCE_END = /[.?!]\s+(?=[A-ZÀ-Ý])/;

export function splitQuestion(text: string): QuestionParts | null {
  const starts: { index: number; contentStart: number }[] = [];
  for (const m of text.matchAll(MARKER)) {
    if (Number(m[2]) !== starts.length + 1) continue;
    starts.push({ index: m.index + m[1].length, contentStart: m.index + m[0].length });
  }
  if (starts.length < 2) return null;

  const items = starts.map((s, i) => text.slice(s.contentStart, starts[i + 1]?.index ?? text.length).trim());
  let outro = '';
  const last = items[items.length - 1];
  const end = SENTENCE_END.exec(last);
  if (end) {
    items[items.length - 1] = last.slice(0, end.index);
    outro = last.slice(end.index + 1).trim();
  }
  return {
    intro: text.slice(0, starts[0].index).trim(),
    items: items.map((item) => item.replace(TRAILING_SEPARATOR, '').trim()),
    outro,
  };
}
