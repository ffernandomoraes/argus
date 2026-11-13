import { memo } from 'react'
import { MarkdownBlock } from '../Markdown'
import { splitMarkdownBlocks } from './markdownBlocks'

// Resposta chegando aos poucos: o texto cresce no fim a cada atualização (~50 ms). Ler o markdown
// inteiro a cada vez custava cada vez mais (16 ms com 32 mil caracteres, mais de meio minuto de
// processador numa resposta longa). Cortado em trechos, só o último é lido de novo: os anteriores
// têm o mesmo texto e o memo do MarkdownBlock os pula. Os trechos saem no mesmo pai, então o
// espaçamento entre eles é o do texto inteiro.
export const StreamingMarkdown = memo(function StreamingMarkdown({ text }: { text: string }) {
  return (
    <div className="break-words" data-markdown="">
      {splitMarkdownBlocks(text).map((block, i) => (
        <MarkdownBlock key={i} text={block} />
      ))}
    </div>
  )
})
