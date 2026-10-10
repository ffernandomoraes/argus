// Endereços da página do protótipo, sempre como caminho do servidor local ("/produtos?q=1#topo"),
// para somar à origem ("http://localhost:3000").

// Só o caminho: ?busca e #âncora não fazem outra página.
export const pathOnly = (route: string): string => route.split(/[?#]/)[0] || '/'

// O que se digita no campo de endereço: "busca" e "//busca" viram "/busca", vazio é a raiz.
// Endereço completo colado (http://localhost:3000/busca?q=1) vira só o caminho, a busca e a âncora.
export function normalizeRoute(text: string): string {
  const typed = text.trim()
  if (/^https?:\/\//i.test(typed)) {
    try {
      const url = new URL(typed)
      return url.pathname + url.search + url.hash
    } catch {
      // Não é um endereço válido: vale como caminho.
    }
  }
  return `/${typed.replace(/^\/+/, '')}`
}

// Endereço que a própria página avisou. Qualquer página pode mandar mensagem, não só o script do
// app: só vale um caminho que, somado à origem, continua nela ("@evil.com/" somado a
// "http://localhost:3000" viraria outro servidor no recarregar e no "Abrir no navegador").
// Devolve o caminho como o navegador o entende (caminho, busca e âncora), ou nulo.
export function pagePath(path: unknown, origin: string): string | null {
  if (typeof path !== 'string' || !path.startsWith('/') || path.length > 2000) return null
  try {
    const url = new URL(origin + path)
    return url.origin === origin ? url.pathname + url.search + url.hash : null
  } catch {
    return null
  }
}
