// Busca pelo nome, como o ⌘P do VS Code: as letras digitadas aparecem no caminho na mesma ordem, sem
// precisar estar juntas ("usefile" acha "useFileTree.ts"). Sem diferença de maiúscula. Vale mais o
// que acerta só no nome do arquivo, em letras seguidas e no começo de palavras; caminho curto ganha
// do longo no empate.

export type FuzzyHit = { path: string; score: number; positions: number[] };

const SEPARATORS = '/\\._- ';

function isBoundary(path: string, i: number): boolean {
  if (i === 0) return true;
  const prev = path[i - 1];
  if (SEPARATORS.includes(prev)) return true;
  // Começo de palavra no meio do nome: useFile|Tree.
  const c = path[i];
  return c !== c.toLowerCase() && prev === prev.toLowerCase() && prev !== prev.toUpperCase();
}

// As letras da busca em `lower` a partir de `from`, sempre na primeira vez que aparecem.
function positionsFrom(query: string, lower: string, from: number): number[] | null {
  const positions: number[] = [];
  let at = from;
  for (const ch of query) {
    const i = lower.indexOf(ch, at);
    if (i < 0) return null;
    positions.push(i);
    at = i + 1;
  }
  return positions;
}

function scoreOf(path: string, positions: number[], nameStart: number): number {
  let score = 0;
  positions.forEach((p, k) => {
    score += 1;
    if (k > 0 && p === positions[k - 1] + 1) score += 5;
    else if (k > 0) score -= 0.5;
    if (isBoundary(path, p)) score += 4;
  });
  if (positions[0] >= nameStart) score += 20;
  if (positions[0] === nameStart) score += 6;
  return score - path.length * 0.02;
}

// Pontuação e letras marcadas de um caminho, ou nulo se a busca não aparece nele.
export function fuzzyMatch(rawQuery: string, path: string): FuzzyHit | null {
  const query = rawQuery.replace(/\s+/g, '').toLowerCase();
  if (!query) return null;
  const lower = path.toLowerCase();
  const nameStart = path.lastIndexOf('/') + 1;
  // Primeiro tenta só no nome do arquivo; com "/" na busca, a pessoa está escrevendo pastas.
  const inName = query.includes('/') ? null : positionsFrom(query, lower, nameStart);
  const positions = inName ?? positionsFrom(query, lower, 0);
  if (!positions) return null;
  let score = scoreOf(path, positions, nameStart);
  if (inName && lower.startsWith(query, nameStart)) {
    score += 15;
    // O nome inteiro, sem a extensão: "filetree" acha FileTree.tsx antes de fileTreeNotes.md.
    const dot = lower.indexOf('.', nameStart + 1);
    if ((dot < 0 ? lower.length : dot) === nameStart + query.length) score += 10;
  }
  return { path, score, positions };
}

// Os melhores `limit` caminhos para a busca, do mais provável para o menos.
export function fuzzyFilter(query: string, paths: readonly string[], limit: number): FuzzyHit[] {
  const hits: FuzzyHit[] = [];
  for (const path of paths) {
    const hit = fuzzyMatch(query, path);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.path.localeCompare(b.path));
  return hits.slice(0, limit);
}
