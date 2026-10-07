import { useCallback, useEffect, useMemo, useState } from 'react'
import { Brain, ChevronRight, FileText, Globe, ListTree, Pencil, X } from 'lucide-react'
import type { MemoryFile, MemoryGroup, MemoryProject } from '../../../shared/memory'
import { FileLinkContext } from '../conversation/fileLinks'
import { Markdown } from '../conversation/Markdown'
import { useEscape } from '../useEscape'

const TYPE_LABEL: Record<string, string> = {
  user: 'sobre você',
  feedback: 'como trabalhar',
  project: 'projeto',
  reference: 'referência'
}

function fileLabel(f: MemoryFile): string {
  if (f.kind === 'index') return 'Índice (MEMORY.md)'
  if (f.kind === 'instructions') return f.fileName
  return f.name ?? f.fileName.replace(/\.md$/, '')
}

// Separa o cabeçalho "---...---" do texto da anotação.
function splitFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

// [[nome]] liga uma anotação a outra; vira link para abrir aqui mesmo.
const linkMemories = (text: string) => text.replace(/\[\[([^\]\n]+)\]\]/g, '[$1](memory:$1)')

const tildify = (path: string) => {
  const home = window.api.homeDir
  return path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
}

// Memória do Claude Code: instruções (CLAUDE.md) e o que ele anotou sozinho, por pasta do canvas.
export function MemoryModal({
  projects,
  only,
  initialProject,
  onClose
}: {
  projects: MemoryProject[]
  // Caminho de uma pasta: mostra só a memória dela, sem o global e sem as outras.
  only?: string
  // Pasta da conversa aberta: começa mostrando a memória dela.
  initialProject?: string
  onClose: () => void
}) {
  const [groups, setGroups] = useState<MemoryGroup[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Grupos abertos na lista da esquerda (id do grupo): começa só com o global, projetos recolhidos.
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['global']))
  const toggleGroup = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const files = useMemo(() => groups.flatMap((g) => g.files), [groups])
  const current = files.find((f) => f.path === selected) ?? null
  const editing = draft !== null
  const dirty = editing && draft !== text

  const reload = useCallback(async () => {
    const all = await window.api.memory.list(projects)
    const list = only ? all.filter((g) => g.projectPath === only) : all
    setGroups(list)
    return list
  }, [projects, only])

  useEffect(() => {
    reload().then((list) => {
      const group = list.find((g) => g.projectPath === (only ?? initialProject)) ?? list[0]
      const first = group?.files.find((f) => f.kind === 'index') ?? group?.files[0]
      setSelected(first?.path ?? null)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return
    let alive = true
    setText(null)
    window.api.memory.read(selected, projects).then((t) => alive && setText(t ?? ''))
    return () => {
      alive = false
    }
  }, [selected, projects])

  const select = (path: string) => {
    if (dirty && !window.confirm('Descartar as alterações deste arquivo?')) return
    setDraft(null)
    setError(null)
    setSelected(path)
  }

  const save = async () => {
    if (!current || draft === null) return
    const ok = await window.api.memory.write(current.path, draft, projects)
    if (!ok) return setError('Não foi possível salvar este arquivo.')
    setText(draft)
    setDraft(null)
    setError(null)
    void reload()
  }

  const close = () => {
    if (dirty && !window.confirm('Descartar as alterações deste arquivo?')) return
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 's' && editing) {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // Editando com alteração, o ESC não faz nada: sair é pelo botão, que pergunta antes de descartar.
  useEscape(() => {
    if (editing && !dirty) setDraft(null)
    else if (!editing) close()
  })

  // Links entre anotações: [[nome]] ou arquivo.md, dentro da mesma pasta de memória.
  const openLink = (target: string) => {
    if (!current) return
    const dir = current.path.slice(0, current.path.lastIndexOf('/'))
    const slug = target.replace(/^memory:/, '').replace(/^\.\//, '')
    const found =
      files.find((f) => f.path.startsWith(dir + '/') && (f.name === slug || f.fileName === slug || f.fileName === `${slug}.md`)) ??
      files.find((f) => f.name === slug)
    if (found) select(found.path)
  }

  const meta = current?.kind === 'memory' ? current : null

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-label="Memória do Claude"
        className="flex h-[min(680px,100%)] w-[min(980px,100%)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <nav className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface-2/40 p-3">
          <div className="mb-3 flex items-center gap-2 px-2 pt-1 text-sm font-semibold">
            <Brain size={15} />
            <span className="truncate">{only ? `Memória - ${groups[0]?.label ?? ''}` : 'Memória'}</span>
          </div>
          {groups.map((g) => (
            <div key={g.id} className="mb-3">
              {/* Com uma pasta só, o nome dela já está no título. */}
              {!only && (
                <button
                  onClick={() => toggleGroup(g.id)}
                  aria-expanded={expanded.has(g.id)}
                  className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-left text-[11px] font-medium uppercase tracking-wide text-faint hover:text-muted"
                >
                  <ChevronRight
                    size={11}
                    className={`shrink-0 transition-transform ${expanded.has(g.id) ? 'rotate-90' : ''}`}
                  />
                  {g.id === 'global' && <Globe size={11} className="shrink-0" />}
                  <span className="truncate">{g.label}</span>
                </button>
              )}
              {(only || expanded.has(g.id)) &&
                g.files.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => select(f.path)}
                    title={f.description ?? tildify(f.path)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                      selected === f.path ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
                    } ${f.kind === 'memory' ? 'pl-5' : ''}`}
                  >
                    {f.kind === 'index' ? <ListTree size={13} className="shrink-0" /> : <FileText size={13} className="shrink-0" />}
                    <span className={`truncate ${f.exists ? '' : 'italic text-faint'}`}>{fileLabel(f)}</span>
                    {!f.exists && <span className="ml-auto shrink-0 text-[10px] text-faint">criar</span>}
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start gap-3 border-b border-line px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{current ? fileLabel(current) : ''}</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{current ? tildify(current.path) : ''}</div>
            </div>
            {current && !editing && (
              <button
                onClick={() => setDraft(text ?? '')}
                className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-text hover:bg-surface-2"
              >
                <Pencil size={12} />
                {current.exists ? 'Editar' : 'Criar'}
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={() => setDraft(null)}
                  className="rounded-md border border-line px-2.5 py-1 text-xs text-text hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void save()}
                  disabled={!dirty}
                  title="Salvar (⌘S)"
                  className="rounded-md bg-text px-2.5 py-1 text-xs font-medium text-bg hover:opacity-85 disabled:opacity-40"
                >
                  Salvar
                </button>
              </>
            )}
            <button
              aria-label="Fechar"
              title="Fechar"
              onClick={close}
              className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
            >
              <X size={15} />
            </button>
          </header>

          {error && <p className="border-b border-line px-5 py-2 text-xs text-red-400">{error}</p>}

          {editing ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-bg px-5 py-4 font-mono text-[12px] leading-relaxed text-text outline-none"
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 select-text">
              {current && !current.exists && (
                <p className="text-xs text-faint">
                  Este arquivo ainda não existe. Use <b>Criar</b> para escrever instruções que o Claude vai seguir nesta
                  {current.path.includes('/.claude/CLAUDE.md') && !current.path.includes('/projects/') ? ' máquina inteira.' : ' pasta.'}
                </p>
              )}
              {meta && (meta.description || meta.type) && (
                <div className="mb-4 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs">
                  {meta.type && (
                    <span className="mr-2 rounded bg-bg px-1.5 py-0.5 text-[10px] text-muted">
                      {TYPE_LABEL[meta.type] ?? meta.type}
                    </span>
                  )}
                  <span className="text-muted">{meta.description}</span>
                </div>
              )}
              {current?.exists && text !== null && (
                <FileLinkContext.Provider value={openLink}>
                  <div className="text-sm leading-relaxed text-text">
                    <Markdown text={linkMemories(splitFrontmatter(text))} />
                  </div>
                </FileLinkContext.Provider>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
