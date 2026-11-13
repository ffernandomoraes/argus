import { useRef } from 'react'
import { File, Folder } from 'lucide-react'
import { indent } from './treeStyle'

// Campo de nome dentro da árvore. Enter ou clicar fora confirma; ESC cancela.
export function NameInput({
  depth,
  isDir,
  initial,
  onSubmit,
  onCancel
}: {
  depth: number
  isDir: boolean
  initial: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const done = useRef(false)
  const finish = (value: string | null) => {
    if (done.current) return
    done.current = true
    const name = value?.trim()
    if (name && name !== initial) onSubmit(name)
    else onCancel()
  }
  const Icon = isDir ? Folder : File

  return (
    <div style={{ paddingLeft: indent(depth) + 16 }} className="flex items-center gap-1.5 py-0.5 pr-2">
      <Icon size={13} className="shrink-0 text-faint" />
      <input
        autoFocus
        defaultValue={initial}
        spellCheck={false}
        // Renomear seleciona só o nome, sem a extensão, como o Finder.
        onFocus={(e) => {
          const dot = initial.lastIndexOf('.')
          e.currentTarget.setSelectionRange(0, !isDir && dot > 0 ? dot : initial.length)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') finish(e.currentTarget.value)
          else if (e.key === 'Escape') {
            e.preventDefault()
            finish(null)
          }
        }}
        onBlur={(e) => finish(e.currentTarget.value)}
        className="min-w-0 flex-1 rounded border border-accent bg-bg px-1.5 py-0.5 text-xs text-text outline-none"
      />
    </div>
  )
}
