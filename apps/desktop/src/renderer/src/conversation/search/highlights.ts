import { fold, foldQuery } from './textSearch';

// Destaque dos resultados da busca na conversa, pela API de destaque do navegador (CSS Custom
// Highlight): pinta trechos de texto sem mexer no HTML das mensagens, que são memorizadas. As cores
// ficam em components.css (::highlight(chat-search) e ::highlight(chat-search-current)).
// Os nomes valem para a janela inteira: com dois drawers buscando ao mesmo tempo, os trechos de cada
// um ficam guardados aqui e o destaque junta todos.
const ALL = 'chat-search';
const CURRENT = 'chat-search-current';

type Marks = { all: Range[]; current: Range | null };
const owners = new Map<object, Marks>();

function apply(): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  const all: Range[] = [];
  const current: Range[] = [];
  for (const marks of owners.values()) {
    for (const r of marks.all) if (r !== marks.current) all.push(r);
    if (marks.current) current.push(marks.current);
  }
  CSS.highlights.set(ALL, new Highlight(...all));
  CSS.highlights.set(CURRENT, new Highlight(...current));
}

export function setHighlights(owner: object, all: Range[], current: Range | null): void {
  owners.set(owner, { all, current });
  apply();
}

export function clearHighlights(owner: object): void {
  if (owners.delete(owner)) apply();
}

// Trechos do termo dentro do texto da mensagem (data-search-text) de `root`, na ordem em que
// aparecem. O texto pode estar quebrado em vários nós (negrito, link, código no meio da frase):
// junta todos e acha o termo no texto corrido, como a busca nos dados.
export function rangesIn(root: Element, query: string): Range[] {
  const needle = foldQuery(query);
  if (!needle) return [];
  const ranges: Range[] = [];
  const areas = root.matches('[data-search-text]') ? [root] : Array.from(root.querySelectorAll('[data-search-text]'));
  for (const area of areas) {
    const nodes: Text[] = [];
    const starts: number[] = [];
    let text = '';
    const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push(node as Text);
      starts.push(text.length);
      text += node.nodeValue ?? '';
    }
    const folded = fold(text);
    for (let at = folded.text.indexOf(needle); at >= 0; at = folded.text.indexOf(needle, at + needle.length)) {
      const start = folded.origin[at];
      const end = folded.origin[at + needle.length - 1] + 1;
      const r = document.createRange();
      const [startNode, startOffset] = locate(nodes, starts, start);
      const [endNode, endOffset] = locate(nodes, starts, end, true);
      r.setStart(startNode, startOffset);
      r.setEnd(endNode, endOffset);
      ranges.push(r);
    }
  }
  return ranges;
}

// Nó e posição dentro dele de uma posição do texto corrido. `end`: o fim de um trecho fica no nó
// onde ele termina, não no começo do seguinte.
function locate(nodes: Text[], starts: number[], at: number, end = false): [Text, number] {
  let i = nodes.length - 1;
  while (i > 0 && (end ? starts[i] >= at : starts[i] > at)) i--;
  return [nodes[i], at - starts[i]];
}
