import { memo, useContext, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileLinkContext, parseFileLink } from './fileLinks'

const LINK = 'text-running underline underline-offset-2'

// Link de arquivo abre no visualizador de código do app; link da web, no navegador.
function Link({ href = '', children }: { href?: string; children?: ReactNode }) {
  const openFile = useContext(FileLinkContext)
  const file = parseFileLink(href)
  if (!file) {
    // O processo principal desvia links com target _blank para o navegador do sistema.
    return (
      <a href={href} target="_blank" rel="noreferrer" className={LINK}>
        {children}
      </a>
    )
  }
  return (
    <a
      href={href}
      title={href}
      onClick={(e) => {
        e.preventDefault()
        openFile?.(file.path, file.lines)
      }}
      className={openFile ? `${LINK} cursor-pointer` : LINK}
    >
      {children}
    </a>
  )
}

// Estilos do markdown das respostas, no tamanho do chat.
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  a: ({ href, children }) => <Link href={href}>{children}</Link>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 marker:text-faint">{children}</li>,
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
// ter o protocolo "c". Caminho do Windows e file:// passam: viram link de arquivo (ver Link).
const urlTransform = (url: string) => (/^([a-zA-Z]:[\\/]|file:)/.test(url) ? url : defaultUrlTransform(url))

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
