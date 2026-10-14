import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Check, GitBranch, Loader2, Plus } from 'lucide-react'
import type { BranchList, BranchOption } from '../../../../shared/sessions'
import { Presence } from '../../motion'
import { MenuArrow } from '../../ui/MenuArrow'
import { MENU_ACTIVE, MENU_HOVER, MENU_PANEL, MENU_ROW } from '../../ui/menuStyles'
import { useAnchoredMenu } from '../../ui/useAnchoredMenu'
import { BranchLabel } from '../BranchLabel'
import { tr } from '../../i18n'

// No máximo isto na lista: repositório com milhares de branches pesava a cada tecla.
const MAX_SHOWN = 100

// Selo da branch acima da pasta. Clicar abre o seletor: busca, branches locais e as que só
// existem no remoto (um fetch roda ao abrir e atualiza a lista), e "Criar branch" quando o
// texto não bate com nenhuma. Com arquivos não comitados, trocar fica bloqueado.
export function BranchSwitcher({ path, branch, changes }: { path: string; branch: string; changes?: number }) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menu = useAnchoredMenu(anchorRef, menuRef)

  return (
    // Clicar no selo não arrasta nem seleciona a pasta no canvas.
    <div onPointerDown={(e) => e.stopPropagation()} className="nodrag nowheel relative flex min-w-0">
      <button
        ref={anchorRef}
        aria-expanded={menu.open}
        onClick={menu.toggle}
        className={`flex h-6 min-w-0 items-center rounded-md border border-line px-2 text-[12px] shadow-sm ${
          menu.open ? 'bg-surface-2 text-text' : 'bg-surface text-muted hover:bg-surface-2 hover:text-text'
        }`}
      >
        <BranchLabel branch={branch} changes={changes} highlight />
      </button>
      <Presence kind="menu">
        {menu.open && <BranchMenu menuRef={menuRef} path={path} changes={changes ?? 0} onDone={menu.close} />}
      </Presence>
    </div>
  )
}

function BranchMenu({
  menuRef,
  path,
  changes,
  onDone
}: {
  menuRef: RefObject<HTMLDivElement | null>
  path: string
  changes: number
  onDone: () => void
}) {
  const [list, setList] = useState<BranchList | null>(null)
  const [fetching, setFetching] = useState(true)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mostra o que já se sabe na hora; o fetch traz as branches novas do remoto logo depois.
  useEffect(() => {
    let alive = true
    window.api.sessions.branches(path).then((l) => alive && setList(l))
    window.api.sessions
      .fetch(path)
      .then((ok) => (ok ? window.api.sessions.branches(path) : null))
      .then((l) => alive && l && setList(l))
      .finally(() => alive && setFetching(false))
    return () => {
      alive = false
    }
  }, [path])

  const q = query.trim()
  const lower = q.toLowerCase()
  const branches = list?.branches ?? []
  const found = branches.filter((b) => !lower || b.name.toLowerCase().includes(lower))
  // Em dois grupos: as locais primeiro, depois as que só existem no remoto. O teclado percorre
  // na mesma ordem.
  const shown = [...found.filter((b) => !b.remote), ...found.filter((b) => b.remote)].slice(0, MAX_SHOWN)
  const firstRemote = shown.findIndex((b) => b.remote)
  // Com um remoto só (o comum), o nome dele em cada linha é repetição: fica no título do grupo.
  const remotes = new Set(shown.flatMap((b) => (b.remote ? [b.remote] : [])))
  const oneRemote = remotes.size === 1 ? [...remotes][0] : null
  const canCreate = !!q && !branches.some((b) => b.name === q)
  // Linhas para o teclado: as branches e, no fim, o "Criar".
  const rows = shown.length + (canCreate ? 1 : 0)
  const blocked = changes > 0

  const choose = async (option: BranchOption, create = false) => {
    if (busy || (!create && option.name === list?.current && !option.remote)) return
    setBusy(option.name)
    setError(null)
    const err = await window.api.sessions.checkout(path, option, create)
    setBusy(null)
    if (err) setError(err)
    else onDone()
  }

  const pick = (i: number) => {
    if (i < shown.length) {
      if (!blocked) void choose(shown[i])
    } else if (canCreate) void choose({ name: q }, true)
  }

  return (
    <div
      ref={menuRef}
      className={`absolute left-0 top-full z-50 mt-2.5 flex max-h-96 w-80 cursor-default flex-col ${MENU_PANEL}`}
    >
      <MenuArrow side="top" />
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (rows) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + rows) % rows)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(active)
          }
        }}
        placeholder={tr('Buscar ou criar branch', 'Search or create a branch')}
        spellCheck={false}
        className="mb-1 h-7 w-full shrink-0 rounded-md bg-fill px-2 font-mono text-[12px] outline-none placeholder:font-sans placeholder:text-faint"
      />
      {blocked && (
        <p className="shrink-0 px-2 pb-1 text-[12px] text-needs-you">
          {changes === 1
            ? tr('1 arquivo não comitado: comite antes de trocar.', '1 uncommitted file: commit before switching.')
            : tr(`${changes} arquivos não comitados: comite antes de trocar.`, `${changes} uncommitted files: commit before switching.`)}
        </p>
      )}
      {error && <p className="shrink-0 whitespace-pre-wrap break-words px-2 pb-1 text-[12px] text-red-400">{error}</p>}
      <div className="min-h-0 overflow-y-auto">
        {!list && !fetching && <p className="px-2 py-1 text-xs text-faint">{tr('Não consegui ler as branches.', 'Couldn’t read the branches.')}</p>}
        {shown.map((b, i) => {
          const current = b.name === list?.current && !b.remote
          const disabled = blocked && !current
          return (
            <Fragment key={(b.remote ?? '') + b.name}>
              {i === 0 && !b.remote && <GroupTitle>{tr('Locais', 'Local')}</GroupTitle>}
              {i === firstRemote && (
                <GroupTitle>{oneRemote ? tr(`Remotas (${oneRemote})`, `Remote (${oneRemote})`) : tr('Remotas', 'Remote')}</GroupTitle>
              )}
              <button
                disabled={disabled}
                title={b.remote ? `${b.remote}/${b.name}` : b.name}
                onClick={() => choose(b)}
                onMouseEnter={() => setActive(i)}
                className={`${MENU_ROW} disabled:opacity-50 ${!disabled && i === active ? MENU_ACTIVE : disabled ? '' : MENU_HOVER}`}
              >
                {busy === b.name ? (
                  <Loader2 size={12} className="shrink-0 animate-spin" />
                ) : current ? (
                  <Check size={12} className="shrink-0" />
                ) : (
                  <GitBranch size={12} className="shrink-0 text-faint" />
                )}
                <span className="min-w-0 truncate font-mono text-text">{b.name}</span>
                {b.remote && !oneRemote && <span className="ml-auto shrink-0 pl-3 text-[11px] text-faint">{b.remote}</span>}
              </button>
            </Fragment>
          )
        })}
        {canCreate && (
          <button
            onClick={() => choose({ name: q }, true)}
            onMouseEnter={() => setActive(shown.length)}
            className={`${MENU_ROW} ${active === shown.length ? MENU_ACTIVE : MENU_HOVER}`}
          >
            {busy === q ? <Loader2 size={12} className="shrink-0 animate-spin" /> : <Plus size={12} className="shrink-0" />}
            <span className="min-w-0 truncate">
              {tr('Criar branch', 'Create branch')} <span className="font-mono">{q}</span>
            </span>
          </button>
        )}
      </div>
      {fetching && (
        <p className="flex shrink-0 items-center gap-1.5 px-2 pt-1 text-[11px] text-faint">
          <Loader2 size={10} className="animate-spin" />
          {tr('Buscando branches no remoto…', 'Fetching branches from the remote…')}
        </p>
      )}
    </div>
  )
}

// Título de cada grupo da lista (Locais, Remotas). Com espaço acima quando não é o primeiro.
function GroupTitle({ children }: { children: ReactNode }) {
  return <p className="px-2 pb-0.5 pt-1.5 text-[11px] font-medium text-faint [&:not(:first-child)]:mt-1">{children}</p>
}
