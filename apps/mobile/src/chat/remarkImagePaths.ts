import { textImagePaths } from '@argus/shared/imageFiles';

// Nó da árvore do markdown (mdast), só com o que este plugin usa.
type Node = { type: string; value?: string; url?: string; children?: Node[] };

// Plugin do markdown: caminho de imagem solto no texto ("salvei em /private/tmp/x/shot.png") vira
// link, e o link de imagem abre o preview (ImageLink). O que já é link fica como está.
export function remarkImagePaths() {
  return (tree: Node) => walk(tree);
}

function walk(node: Node): void {
  if (!node.children || node.type === 'link' || node.type === 'linkReference') return;
  node.children = node.children.flatMap((child) => {
    if (child.type === 'text') return splitText(child.value ?? '');
    walk(child);
    return [child];
  });
}

function splitText(value: string): Node[] {
  const found = textImagePaths(value);
  if (!found.length) return [{ type: 'text', value }];
  const nodes: Node[] = [];
  let at = 0;
  for (const { index, path } of found) {
    if (index > at) nodes.push({ type: 'text', value: value.slice(at, index) });
    nodes.push({ type: 'link', url: path, children: [{ type: 'text', value: path }] });
    at = index + path.length;
  }
  if (at < value.length) nodes.push({ type: 'text', value: value.slice(at) });
  return nodes;
}
