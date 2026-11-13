import type { Page } from '../ipc/page';
import { PageMap } from './pages';

type Size = { cols: number; rows: number };

// O tamanho de cada terminal quando ele aparece em mais de uma página (o canvas em dois monitores,
// ou o computador de casa e o notebook pelo acesso remoto). O processo tem um tamanho só, e o
// `claude` redesenha a tela pela largura dele: com cada página mandando o seu, a outra recebia um
// desenho de outra largura e as letras se embaralhavam.
//
// Quem clicou ou digitou por último é o dono e manda no tamanho. O que as outras pedem fica anotado
// (vale quando elas virarem donas); enquanto isso, elas desenham no tamanho do processo (o aviso
// `terminal:size` diz a cada página se ela é a dona).
export class TerminalSizes {
  private owners = new Map<string, Page>();
  // Página → terminal → o tamanho que cabe na caixa dela.
  private wanted = new PageMap<Map<string, Size>>((page) => {
    for (const [key, owner] of [...this.owners]) if (owner === page) this.owners.delete(key);
  });

  constructor(
    private apply: (key: string, cols: number, rows: number) => void,
    private current: (key: string) => Size | null,
    private notify: (key: string, size: Size, owner: Page | null) => void,
  ) {}

  // A página mediu o terminal. `claim`: ela pegou o terminal (clique, foco ao abrir) e vira a dona.
  request(page: Page, key: string, cols: number, rows: number, claim: boolean): void {
    if (cols <= 0 || rows <= 0) return;
    const byKey = this.wanted.get(page) ?? new Map<string, Size>();
    byKey.set(key, { cols, rows });
    this.wanted.set(page, byKey);
    const owner = this.owners.get(key);
    if (!claim && owner && owner !== page && !owner.isDestroyed()) return;
    this.owners.set(key, page);
    this.apply(key, cols, rows);
    this.announce(key);
  }

  // A página digitou: passa a ser a dona, com o tamanho que ela tinha medido.
  typed(page: Page, key: string): void {
    if (this.owners.get(key) === page) return;
    this.owners.set(key, page);
    const size = this.wanted.get(page)?.get(key);
    if (size) this.apply(key, size.cols, size.rows);
    this.announce(key);
  }

  isOwner(page: Page, key: string): boolean {
    return this.owners.get(key) === page;
  }

  forget(key: string): void {
    this.owners.delete(key);
  }

  private announce(key: string): void {
    const size = this.current(key);
    if (size) this.notify(key, size, this.owners.get(key) ?? null);
  }
}
