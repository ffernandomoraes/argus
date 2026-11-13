import { useEffect, useState } from 'react'
import { Plus, Search, Star, XCircle } from 'lucide-react'
import type { SearchHit, SessionSummary } from '@argus/shared/sessions'
import { tr } from '../i18n'
import { useFavorites, useSessions, useWorkspaces } from '../lib/data'
import { useHost } from '../lib/host'
import { back, go } from '../lib/router'
import { ago, baseName, dateGroup } from '../ui/format'
import { Empty, Row, Section } from '../ui/List'
import { FLOATING_HEADER_SPACE, FloatingHeader, ROUND_BUTTON } from '../ui/FloatingHeader'
import { GroupLabel } from '../ui/GroupLabel'
import { StatusDot } from '../ui/StatusDot'

const PAGE = 60

export const newChatId = () => `new-${crypto.randomUUID().slice(0, 8)}`

// O caminho com a pasta pessoal do computador como "~" (mais curto no celular).
function shortPath(path: string, home: string | undefined): string {
  if (home && (path === home || path.startsWith(`${home}/`) || path.startsWith(`${home}\\`))) return `~${path.slice(home.length)}`
  return path
}

// Sem acento nem maiúscula, para comparar ("Gestão" acha "gestao").
const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Busca nas conversas da pasta: pelo título na hora, e pelo conteúdo no Argus (a mesma busca da
// lista de conversas de lá), um instante depois de parar de digitar.
function useSearch(path: string, query: string): SearchHit[] | null {
  const { conn } = useHost()
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  useEffect(() => {
    setHits(null)
    const q = query.trim()
    if (q.length < 2) return
    let alive = true
    const timer = setTimeout(() => {
      conn.call('sessions:search', path, q).then(
        (h) => alive && setHits(h),
        () => alive && setHits([])
      )
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [conn, path, query])
  return hits
}

function SessionRow({ s, path, favorite, snippet }: { s: SessionSummary; path: string; favorite?: boolean; snippet?: string }) {
  return (
    <Row
      icon={s.live && s.live !== 'idle' ? <StatusDot status={s.live} /> : favorite ? <Star size={16} className="fill-orange text-orange" /> : undefined}
      title={s.title || tr('Sem título', 'Untitled')}
      // A data no fim da linha; embaixo do título, só o trecho achado na busca.
      trailing={<span className="text-[13px] text-faint">{ago(s.repliedAt || s.updatedAt)}</span>}
      subtitle={snippet}
      onClick={() => go({ name: 'chat', cwd: path, id: s.id })}
    />
  )
}

// Uma pasta: título grande (nome, grupo e caminho), o botão de conversa nova e as conversas dela,
// das mais recentes para as antigas.
export function FolderScreen({ path }: { path: string }) {
  const { conn } = useHost()
  const { list } = useSessions(path)
  const { workspaces } = useWorkspaces()
  const folder = workspaces.flatMap((w) => w.groups.flatMap((g) => g.folders)).find((f) => f.path === path)
  const name = folder?.name ?? baseName(path)
  const newChat = () => go({ name: 'chat', cwd: path, id: newChatId() })
  const favorites = useFavorites()
  const [query, setQuery] = useState('')
  const hits = useSearch(path, query)
  const all = list ?? []
  const favoriteList = all.filter((s) => favorites.has(s.id))
  const others = all.filter((s) => !favorites.has(s.id))
  // As outras em grupos de data (a lista já vem da mais recente para a mais antiga), PAGE por vez.
  const [shown, setShown] = useState(PAGE)
  const byDate: [string, SessionSummary[]][] = []
  for (const s of others.slice(0, shown)) {
    const label = dateGroup(s.repliedAt || s.updatedAt)
    const last = byDate[byDate.length - 1]
    if (last?.[0] === label) last[1].push(s)
    else byDate.push([label, [s]])
  }
  // Resultados: primeiro os que batem no título, depois os achados pelo conteúdo (com o trecho).
  const searching = query.trim().length > 0
  const q = fold(query.trim())
  const byTitle = searching ? all.filter((s) => fold(s.title).includes(q)) : []
  const byId = new Map(all.map((s) => [s.id, s]))
  const results = [
    ...byTitle.map((s) => ({ s, snippet: undefined as string | undefined })),
    ...(hits ?? []).filter((h) => byId.has(h.id) && !byTitle.some((s) => s.id === h.id)).map((h) => ({ s: byId.get(h.id)!, snippet: h.snippet }))
  ]
  return (
    <div className="min-h-full">
      {/* Topo flutuante: voltar, o grupo da pasta na pílula colorida (como no canvas) e o + de
          conversa nova. */}
      <FloatingHeader
        onBack={() => back({ name: 'home' })}
        backLabel={tr('Início', 'Home')}
        title={
          <span className="inline-flex max-w-full">
            <GroupLabel label={folder?.group?.label || tr('Sem grupo', 'No group')} color={folder?.group?.color} />
          </span>
        }
        right={
          <button type="button" onClick={newChat} aria-label={tr('Nova conversa', 'New chat')} className={ROUND_BUTTON}>
            <Plus size={24} />
          </button>
        }
      />
      <div className={`px-safe pb-end ${FLOATING_HEADER_SPACE}`}>
        <h1 className="px-4 pt-1 text-[22px] leading-tight font-bold tracking-tight break-words">{name}</h1>
        <p className="mt-1 truncate px-4 text-[15px] text-muted" title={path}>
          {shortPath(path, conn.info?.homeDir)}
        </p>

      <label className="mt-4 flex items-center gap-2 rounded-[12px] bg-code px-3 py-2">
        <Search size={18} className="shrink-0 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder={tr('Buscar conversas', 'Search chats')}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" aria-label={tr('Limpar', 'Clear')} onClick={() => setQuery('')} className="shrink-0 text-faint">
            <XCircle size={18} className="fill-faint text-bg" />
          </button>
        )}
      </label>

      {searching ? (
        <Section title={tr('Resultados', 'Results')}>
          {results.map(({ s, snippet }) => (
            <SessionRow key={s.id} s={s} path={path} favorite={favorites.has(s.id)} snippet={snippet} />
          ))}
          {!results.length && <Empty>{hits === null && query.trim().length >= 2 ? tr('Buscando…', 'Searching…') : tr('Nada encontrado.', 'Nothing found.')}</Empty>}
        </Section>
      ) : (
        <>
          {favoriteList.length > 0 && (
            <Section title={tr('Favoritas', 'Favorites')}>
              {favoriteList.map((s) => (
                <SessionRow key={s.id} s={s} path={path} favorite />
              ))}
            </Section>
          )}
          {list === undefined && (
            <Section title={tr('Conversas', 'Chats')}>
              <Empty>{tr('Carregando…', 'Loading…')}</Empty>
            </Section>
          )}
          {list !== undefined && others.length === 0 && (
            <Section title={tr('Conversas', 'Chats')}>
              <Empty>{tr('Nenhuma conversa nesta pasta.', 'No chats in this folder.')}</Empty>
            </Section>
          )}
          {byDate.map(([label, items]) => (
            <Section key={label} title={label}>
              {items.map((s) => (
                <SessionRow key={s.id} s={s} path={path} />
              ))}
            </Section>
          ))}
          {others.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-4 w-full py-2 text-[15px] text-accent active:opacity-50">
              {tr(`Mostrar mais (${others.length - shown})`, `Show more (${others.length - shown})`)}
            </button>
          )}
        </>
      )}
      </div>
    </div>
  )
}
