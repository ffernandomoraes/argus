// Imagens enviadas numa mensagem: lê (miniaturas) e abre o preview grande numa delas. `ready`: as
// já lidas, na hora, sem esperar a leitura.
export type ImageView = { load: () => Promise<string[]>; open: (index: number) => void; ready?: () => string[] | undefined };

type Read = (messageId: string) => Promise<string[]>;
// Uma leitura guardada; `urls` chega quando ela termina.
type Entry = { promise: Promise<string[]>; urls?: string[] };

// Leituras guardadas: a miniatura e o preview grande usam a mesma. Só as últimas ficam (as que
// saíram são lidas de novo se voltarem): conversa longa com muitos prints não segura todas na
// memória.
const KEEP = 30;

// Um objeto por mensagem, sempre o mesmo: o balão memorizado não redesenha e a miniatura não refaz
// o observador. Quem lê as imagens gravadas muda com a conversa (setReader); a mensagem ainda a
// caminho traz a sua leitura própria (as imagens que estão no envio).
export function createImageViews(open: (load: () => Promise<string[]>, start: number) => void) {
  let read: Read | undefined;
  const views = new Map<string, ImageView>();
  const cache = new Map<string, Entry>();

  const cached = (id: string): Entry => {
    let entry = cache.get(id);
    if (entry) cache.delete(id);
    else {
      const fresh: Entry = { promise: (read ? read(id) : Promise.resolve([])).catch(() => []) };
      void fresh.promise.then((urls) => {
        fresh.urls = urls;
      });
      entry = fresh;
    }
    cache.set(id, entry);
    if (cache.size > KEEP) cache.delete(cache.keys().next().value as string);
    return entry;
  };

  return {
    setReader(next: Read | undefined): void {
      read = next;
    },
    viewFor(id: string, own?: () => Promise<string[]>): ImageView {
      let view = views.get(id);
      if (!view) {
        const load = own ?? (() => cached(id).promise);
        // A miniatura que volta à tela (a lista virtualizada a desmonta ao rolar para longe) nasce
        // com as imagens já lidas. Antes, nascia com quadros vazios e as imagens entravam um instante
        // depois: piscava toda vez que a mensagem voltava à tela.
        const ready = own ? undefined : () => cache.get(id)?.urls;
        view = { load, ready, open: (start) => open(load, start) };
        views.set(id, view);
      }
      return view;
    },
  };
}
