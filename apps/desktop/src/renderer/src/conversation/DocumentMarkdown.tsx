import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS, urlTransform } from './markdownComponents'

// Os do chat, com os títulos no tamanho de um documento: o do chat cabe na conversa, este é para
// ler um plano ou um .md inteiro.
const DOCUMENT_COMPONENTS: Components = {
  ...MARKDOWN_COMPONENTS,
  h1: ({ children }) => <h1 className="mb-4 mt-8 border-b border-line pb-2 text-[24px] font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-7 border-b border-line pb-1.5 text-[19px] font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-[16px] font-semibold first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-4 text-[15px] font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>
}

// Markdown como documento: plano aberto ao lado da conversa e prévia de arquivo .md.
export const DocumentMarkdown = memo(function DocumentMarkdown({ text }: { text: string }) {
  return (
    <div className="break-words text-[15px] leading-relaxed" data-markdown="">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={DOCUMENT_COMPONENTS} urlTransform={urlTransform}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
