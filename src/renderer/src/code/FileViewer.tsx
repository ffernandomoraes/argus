import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { bundledLanguages, codeToHtml } from 'shiki'
import type { FileContent } from '../../../shared/files'
import type { LineRange } from '../conversation/fileLinks'

// Acima disso, mostra texto puro: colorir arquivo enorme trava a interface.
const HIGHLIGHT_LIMIT = 300_000

const ALIASES: Record<string, string> = { mjs: 'js', cjs: 'js', mts: 'ts', cts: 'ts', yml: 'yaml', zsh: 'sh' }

function languageOf(path: string): string {
  const name = path.split('/').pop() ?? ''
  if (name === 'Dockerfile') return 'docker'
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const lang = ALIASES[ext] ?? ext
  return lang in bundledLanguages ? lang : 'text'
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function plainHtml(text: string): string {
  const lines = text.split('\n').map((l) => `<span class="line">${escapeHtml(l)}</span>`)
  return `<pre class="shiki"><code>${lines.join('\n')}</code></pre>`
}

// Faixa de linhas (base 0, no texto novo) entre o começo e o fim que continuam iguais.
function changedLines(before: string, after: string): { start: number; end: number } | null {
  const a = before.split('\n')
  const b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length - 1
  let endB = b.length - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--
    endB--
  }
  if (start > endB) return null
  return { start, end: endB }
}

// Painel central: conteúdo do arquivo com a mesma coloração do VS Code (tema Dark+).
export function FileViewer({
  root,
  path,
  lines,
  rightOffset,
  onClose
}: {
  root: string
  path: string
  // Linhas citadas num link do chat: ficam destacadas e o arquivo abre nelas.
  lines?: LineRange
  // Espaço ocupado pelo painel da conversa à direita.
  rightOffset: number | string
  onClose: () => void
}) {
  const [content, setContent] = useState<FileContent | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const codeRef = useRef<HTMLDivElement>(null)
  const scrolledTo = useRef<LineRange | undefined>(undefined)
  // Recarga por mudança no disco: mantém a rolagem e marca as linhas que mudaram.
  const [revision, setRevision] = useState(0)
  const changedRef = useRef<{ start: number; end: number } | null>(null)
  const previousText = useRef<string | null>(null)

  useEffect(() => {
    window.api.files.watch(root, path)
    const off = window.api.files.onChanged((r, p) => {
      if (r === root && p === path) setRevision((n) => n + 1)
    })
    return () => {
      off()
      window.api.files.unwatch()
    }
  }, [root, path])

  useEffect(() => {
    const rows = codeRef.current?.querySelectorAll<HTMLElement>('.line')
    if (!rows) return
    rows.forEach((row, i) => row.classList.toggle('line-highlight', !!lines && i + 1 >= lines.start && i + 1 <= lines.end))
    // Rola até o trecho só quando o link muda, não a cada recarga do arquivo.
    if (lines && scrolledTo.current !== lines) {
      scrolledTo.current = lines
      rows[lines.start - 1]?.scrollIntoView({ block: 'center' })
    }
  }, [html, lines])

  useEffect(() => {
    let cancelled = false
    const reloading = revision > 0
    if (!reloading) {
      setContent(null)
      setHtml(null)
      previousText.current = null
    }
    window.api.files.read(root, path).then(async (res) => {
      if (cancelled) return
      setContent(res)
      if (!res.ok) return
      changedRef.current = reloading && previousText.current !== null ? changedLines(previousText.current, res.text) : null
      previousText.current = res.text
      const out =
        res.text.length > HIGHLIGHT_LIMIT
          ? plainHtml(res.text)
          : await codeToHtml(res.text, { lang: languageOf(path), theme: 'dark-plus' })
      if (!cancelled) setHtml(out)
    })
    return () => {
      cancelled = true
    }
  }, [root, path, revision])

  // Destaque das linhas que mudaram na última recarga; some sozinho.
  useEffect(() => {
    const range = changedRef.current
    const rows = codeRef.current?.querySelectorAll<HTMLElement>('.line')
    if (!range || !rows) return
    for (let i = range.start; i <= range.end && i < rows.length; i++) rows[i].classList.add('line-changed')
    const id = setTimeout(() => rows.forEach((r) => r.classList.remove('line-changed')), 2500)
    return () => clearTimeout(id)
  }, [html])

  return (
    <section
      style={{ right: rightOffset }}
      className="absolute bottom-4 left-[312px] top-4 z-40 flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-[#1e1e1e] shadow-2xl shadow-black/50">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5">
        <span className="flex-1 truncate font-mono text-xs text-muted" title={path}>
          {path}
        </span>
        {content?.ok && content.truncated && <span className="text-[11px] text-needs-you">mostrando só o primeiro 1 MB</span>}
        <button
          aria-label="Fechar arquivo"
          title="Fechar arquivo"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
        >
          <X size={15} />
        </button>
      </header>
      <div className="code-view min-h-0 flex-1 overflow-auto select-text">
        {!content && <p className="p-4 text-xs text-faint">Carregando…</p>}
        {content && !content.ok && <p className="p-4 text-xs text-faint">{content.error}</p>}
        {html && <div ref={codeRef} dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </section>
  )
}
