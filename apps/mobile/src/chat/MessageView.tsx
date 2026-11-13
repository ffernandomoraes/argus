import { memo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertCircle, Brain, ChevronDown, ChevronRight, FileText, Image as ImageIcon, Wrench } from 'lucide-react'
import { filesInBlock, withoutLegacyFiles } from '@argus/shared/attachedFiles'
import type { DiffHunk, Message } from '@argus/shared/history'
import { tr } from '../i18n'
import { useHost } from '../lib/host'
import { baseName, formatDuration, formatTokens, messageTime } from '../ui/format'
import type { TurnFooter } from './turnFooters'

// Uma mensagem do histórico, do jeito compacto do celular: as suas em balão, as respostas em texto
// formatado, e cada ferramenta numa linha que abre ao tocar.

const FILES_BLOCK = /\n*<argus-files(?: sizes="[\d,]*")?>\n[\s\S]*?\n<\/argus-files>\s*$/

export const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  return (
    <div className="prose-chat text-[17px]">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          // Imagens de fora não carregam (a página só fala com a ponte).
          img: ({ alt }) => <span className="text-muted">[{alt || 'imagem'}]</span>
        }}
      >
        {text}
      </Markdown>
    </div>
  )
})

function DiffLines({ diff }: { diff: DiffHunk[] }) {
  return (
    <pre className="mt-1 overflow-x-auto rounded-lg bg-code p-2 font-mono text-[12px] leading-snug">
      {diff.flatMap((h, i) => [
        i > 0 ? <div key={`s${i}`} className="text-faint">⋯</div> : null,
        ...h.lines.slice(0, 200).map((l, j) => (
          <div key={`${i}:${j}`} className={l.startsWith('+') ? 'text-green' : l.startsWith('-') ? 'text-red' : 'text-muted'}>
            {l || ' '}
          </div>
        ))
      ])}
    </pre>
  )
}

function ToolRow({ m }: { m: Extract<Message, { role: 'tool' }> }) {
  const [open, setOpen] = useState(false)
  const result = m.result.length > 4000 ? `${m.result.slice(0, 4000)}\n…` : m.result
  return (
    <div className="text-[15px]">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-1.5 py-1 text-left text-muted active:opacity-60">
        {m.error ? <AlertCircle size={16} className="mt-0.5 shrink-0 text-red" /> : <Wrench size={15} className="mt-0.5 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className={`font-medium ${m.error ? 'text-red' : 'text-text'}`}>{m.agent ? `${m.label}: ${m.agent}` : m.label}</span>
          {m.input && <span className="text-muted"> - {m.input}</span>}
        </span>
        {open ? <ChevronDown size={16} className="mt-0.5 shrink-0" /> : <ChevronRight size={16} className="mt-0.5 shrink-0" />}
      </button>
      {open && (
        <div className="mb-2 ml-5">
          {m.detail && <pre className="overflow-x-auto rounded-lg bg-code p-2 font-mono text-[12px] whitespace-pre-wrap">{m.detail}</pre>}
          {m.diff?.length ? <DiffLines diff={m.diff} /> : null}
          {m.document ? (
            <div className="mt-1 rounded-lg bg-code p-2">
              <MarkdownText text={m.document} />
            </div>
          ) : (
            result && <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-code p-2 font-mono text-[12px] whitespace-pre-wrap">{result}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function Thinking({ m }: { m: Extract<Message, { role: 'thinking' }> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="text-[15px] text-muted">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 py-1 active:opacity-60">
        <Brain size={15} />
        {m.seconds ? tr(`Pensou por ${m.seconds}s`, `Thought for ${m.seconds}s`) : tr('Pensou', 'Thought')}
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open && <p className="mb-2 ml-5 text-[15px] whitespace-pre-wrap italic">{m.text}</p>}
    </div>
  )
}

function UserImages({ cwd, sessionId, messageId, count }: { cwd: string; sessionId: string; messageId: string; count: number }) {
  const { conn } = useHost()
  const [images, setImages] = useState<string[] | null>(null)
  if (images)
    return (
      <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
        {images.map((src, i) => (
          <img key={i} src={src} alt="" className="max-h-48 max-w-[70%] rounded-xl object-cover" />
        ))}
      </div>
    )
  return (
    <button
      type="button"
      className="mt-1 flex items-center gap-1 text-[13px] text-white/85 underline-offset-2 active:opacity-60"
      onClick={() => void conn.call('sessions:images', cwd, sessionId, messageId).then(setImages, () => setImages([]))}
    >
      <ImageIcon size={14} />
      {count === 1 ? tr('1 imagem - ver', '1 image - view') : tr(`${count} imagens - ver`, `${count} images - view`)}
    </button>
  )
}

// Hora embaixo da mensagem, pequena, do lado dela.
function Time({ at, right }: { at?: string; right?: boolean }) {
  const text = messageTime(at)
  return text ? <div className={`mt-0.5 text-[12px] text-faint tabular-nums ${right ? 'pr-1 text-right' : ''}`}>{text}</div> : null
}

export function UserBubble({
  text,
  pending,
  images,
  files,
  imageRef,
  at
}: {
  text: string
  pending?: boolean
  images?: number
  files?: string[]
  imageRef?: { cwd: string; sessionId: string; messageId: string }
  at?: string
}) {
  return (
    <div className="flex flex-col items-end py-1">
      <div className={`max-w-[85%] rounded-[18px] bg-bubble px-3.5 py-2 text-[17px] leading-snug whitespace-pre-wrap text-white ${pending ? 'opacity-60' : ''}`} style={{ overflowWrap: 'anywhere' }}>
        {text}
        {files?.map((f) => (
          <span key={f} className="mt-1 flex items-center gap-1 text-[13px] text-white/85">
            <FileText size={14} /> {baseName(f)}
          </span>
        ))}
        {images && imageRef ? <UserImages {...imageRef} count={images} /> : images ? <span className="mt-1 block text-[13px] text-white/85">{tr(`${images} imagem(ns)`, `${images} image(s)`)}</span> : null}
      </div>
      {pending ? <div className="mt-0.5 pr-1 text-[12px] text-faint">{tr('Enviando…', 'Sending…')}</div> : <Time at={at} right />}
    </div>
  )
}

// footer: só no último texto de cada pedido, como no Argus: "14:32 - levou 1min 05s - 2,3 mil tokens".
export const MessageView = memo(function MessageView({ m, cwd, sessionId, footer }: { m: Message; cwd: string; sessionId?: string; footer?: TurnFooter }) {
  switch (m.role) {
    case 'user': {
      const legacy = withoutLegacyFiles(m.text.replace(FILES_BLOCK, ''))
      const files = [...(m.files ?? filesInBlock(m.text)), ...legacy.files].map((f) => f.path)
      return (
        <UserBubble
          text={legacy.text.trim()}
          images={m.images}
          files={files}
          imageRef={sessionId && m.images ? { cwd, sessionId, messageId: m.id } : undefined}
          at={m.at}
        />
      )
    }
    case 'assistant':
      return (
        <div className="py-1">
          <MarkdownText text={m.text} />
          {footer && (
            <div className="mt-0.5 text-[12px] text-faint tabular-nums">
              {messageTime(footer.at)}
              {footer.duration !== undefined && tr(` - levou ${formatDuration(footer.duration)}`, ` - took ${formatDuration(footer.duration)}`)}
              {footer.tokens > 0 && ` - ${formatTokens(footer.tokens)}`}
            </div>
          )}
        </div>
      )
    case 'thinking':
      return <Thinking m={m} />
    case 'tool':
      return <ToolRow m={m} />
    case 'output':
      return <pre className="my-1 overflow-x-auto rounded-lg bg-code p-2 font-mono text-[12px] whitespace-pre-wrap">{m.text}</pre>
    case 'event':
      return (
        <div className="my-2 flex items-center gap-2 text-[13px] text-faint">
          <span className="h-px flex-1 bg-line" />
          <span className="max-w-[80%] truncate">{m.text}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )
  }
})
