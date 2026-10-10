import { useRef, useState } from 'react'
import type { UncommittedFile } from '../../../../shared/sessions'
import { BranchLabel } from '../../canvas/BranchLabel'
import { Presence } from '../../motion'
import { lastSep, relativeTo, tildify, untildify } from '../../platform'
import { useEscape } from '../../useEscape'
import { useOutsideClick } from '../../useOutsideClick'
import { KIND_COLOR, KIND_LABEL } from './changeKinds'

// Pasta e branch no cabeçalho: o mesmo selo de cima do card da pasta no canvas.
export const TAG = 'flex h-6 items-center rounded-md border border-line bg-surface px-2 text-muted shadow-sm'

// Selo da branch. Com arquivos não comitados, traz o número deles (o mesmo selo de cima do
// card da pasta no canvas) e vira botão: clicar abre a lista; clicar num arquivo abre o diff
// dele no código da pasta.
export function BranchTag({
  cwd,
  branch,
  files,
  onOpenDiff
}: {
  cwd: string
  branch: string
  files: UncommittedFile[] | null
  onOpenDiff?: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  useEscape(() => setOpen(false), open)

  if (!files?.length)
    return (
      <span className={`${TAG} max-w-[40%] shrink-0`}>
        <BranchLabel branch={branch} />
      </span>
    )

  const n = files.length
  const label = `${n} ${n === 1 ? 'arquivo não comitado' : 'arquivos não comitados'}`
  // Caminhos relativos à pasta da conversa; fora dela (pasta é parte do repo), com ~.
  const root = untildify(cwd)
  const shown = (path: string) => relativeTo(path, root) || tildify(path)

  return (
    // Clicar no selo não arrasta a janela (no-drag), o bloco no canvas (nodrag) nem o painel
    // (o pointerdown não sobe para o cabeçalho).
    <div ref={ref} onPointerDown={(e) => e.stopPropagation()} className="no-drag nodrag relative flex max-w-[40%] shrink-0">
      <button
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${TAG} min-w-0 ${open ? 'bg-surface-2 text-text' : 'hover:bg-surface-2 hover:text-text'}`}
      >
        <BranchLabel branch={branch} changes={n} />
      </button>

      <Presence kind="menu">
        {open && (
          // pointerdown não sobe: o cabeçalho arrasta o painel.
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-0 top-full z-50 mt-1 flex max-h-96 w-80 cursor-default flex-col rounded-lg border border-line bg-surface shadow-2xl shadow-black/30"
          >
            <div className="shrink-0 border-b border-line px-3 py-2 text-[12px] text-faint">{label}</div>
            <ul className="min-h-0 overflow-y-auto p-1">
              {files.map((f) => {
                const rel = shown(f.path)
                const slash = lastSep(rel)
                const name = rel.slice(slash + 1)
                const dir = slash > 0 ? rel.slice(0, slash) : ''
                // Fora da pasta, o visualizador não alcança.
                const canOpen = !!onOpenDiff && !!relativeTo(f.path, root)
                return (
                  <li key={f.path}>
                    <button
                      disabled={!canOpen}
                      title={rel}
                      onClick={() => {
                        onOpenDiff?.(f.path)
                        setOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs enabled:hover:bg-surface-2"
                    >
                      <span className={`min-w-0 truncate text-text ${f.kind === 'D' ? 'line-through' : ''}`}>{name}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-faint">{dir}</span>
                      <span title={KIND_LABEL[f.kind]} className={`shrink-0 font-mono text-[12px] font-semibold ${KIND_COLOR[f.kind]}`}>
                        {f.kind}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Presence>
    </div>
  )
}
