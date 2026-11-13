import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS, urlTransform } from './markdownComponents'

// Um trecho de markdown sem caixa em volta: os elementos saem direto no pai. Vários trechos
// seguidos no mesmo pai ficam iguais ao texto inteiro (é o que a resposta chegando aos poucos usa,
// ver timeline/StreamingMarkdown). Memorizado: trecho com o mesmo texto não é lido de novo.
export const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS} urlTransform={urlTransform}>
      {text}
    </ReactMarkdown>
  )
})

// Texto do Claude (ou de um arquivo de memória) formatado. data-markdown: as notas de rodapé
// procuram o destino dentro dele.
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="break-words" data-markdown="">
      <MarkdownBlock text={text} />
    </div>
  )
})
