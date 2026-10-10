import { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MarkdownImage, MarkdownLink } from './MarkdownLink'

export const REMARK_PLUGINS = [remarkGfm]

// Estilos do markdown das respostas, no tamanho do chat.
export const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  // O id fica: é o destino das notas de rodapé e da volta delas.
  a: ({ href, id, children }) => (
    <MarkdownLink href={href} id={id}>
      {children}
    </MarkdownLink>
  ),
  img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ id, children }) => (
    <li id={id} className="pl-0.5 marker:text-faint">
      {children}
    </li>
  ),
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-[16px] font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-[15px] font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 text-[15px] font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1 mt-3 text-[15px] font-medium first:mt-0">{children}</h4>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-line-strong pl-3 text-muted">{children}</blockquote>,
  hr: () => <hr className="my-3 border-line" />,
  // Código em linha; o de bloco é estilizado pelo <pre> abaixo.
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[13px]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-[13px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line bg-surface-2 px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2 py-1 align-top">{children}</td>
}

// Por padrão o markdown descarta link com protocolo que não seja da web, e "C:\proj\a.ts" parece
// ter o protocolo "c". Caminho do Windows e file:// passam nos links (viram link de arquivo, ver
// MarkdownLink), mas nunca no endereço de uma imagem. A barra invertida chega codificada (%5C):
// sem aceitar assim, o link do caminho do Windows saía vazio e não fazia nada.
export function urlTransform(url: string, key: string): string {
  return key !== 'src' && /^([a-zA-Z]:([\\/]|%5[cC])|file:)/.test(url) ? url : defaultUrlTransform(url)
}
