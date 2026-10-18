import { useEffect, useState } from 'react'
import { Bug, ExternalLink, Minus, ScrollText, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react'
import type { ReleaseNote, ReleaseNoteKind } from '../../../shared/updates'
import { Modal } from '../ui/Modal'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { LOCALE, tr } from '../i18n'

const RELEASES_URL = 'https://github.com/ffernandomoraes/argus/releases'

// Ícone na frente de cada mudança, na cor do texto; o nome aparece ao passar o mouse.
const KIND: Record<ReleaseNoteKind, { label: string; icon: LucideIcon }> = {
  feature: { label: tr('Funcionalidade', 'Feature'), icon: Sparkles },
  improvement: { label: tr('Melhoria', 'Improvement'), icon: TrendingUp },
  bug: { label: tr('Bug', 'Bug'), icon: Bug }
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })

function KindIcon({ kind }: { kind: ReleaseNoteKind | null }) {
  const { label, icon: Icon } = kind ? KIND[kind] : { label: undefined, icon: Minus }
  return (
    <span title={label} className="flex h-[18px] shrink-0 items-center text-faint">
      <Icon size={13} aria-label={label} aria-hidden={!label} />
    </span>
  )
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ok'; notes: ReleaseNote[] }

// Novidades: o que mudou nas últimas versões, lido dos releases do GitHub a cada abertura.
export function ReleaseNotesModal({ current, onClose }: { current: string; onClose: () => void }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    window.api.updates
      .notes()
      .then((notes) => alive && setLoad({ status: 'ok', notes }))
      .catch((err: unknown) => {
        console.error('[novidades]', err)
        if (alive) setLoad({ status: 'error' })
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <Modal label={tr('Novidades', "What's new")} size="md" className="flex flex-col" onClose={onClose}>
      <header className="flex items-start gap-3 border-b border-line px-5 py-3">
        <ScrollText size={15} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{tr('Novidades', "What's new")}</div>
          <div className="mt-0.5 truncate text-[12px] text-faint">{tr('O que mudou nas últimas versões do Argus', 'What changed in the latest Argus versions')}</div>
        </div>
        <ModalCloseButton />
      </header>

      {load.status === 'loading' ? (
        <p className="px-5 py-10 text-center text-sm text-muted">{tr('Buscando no GitHub…', 'Fetching from GitHub…')}</p>
      ) : load.status === 'error' || load.notes.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          {load.status === 'error'
            ? tr('Não deu para buscar as novidades no GitHub.', "Couldn't fetch the release notes from GitHub.")
            : tr('Nenhuma versão publicada ainda.', 'No published versions yet.')}
        </p>
      ) : (
        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {load.notes.map((note) => (
            <section key={note.version}>
              <div className="flex items-baseline gap-2">
                <span className="text-[17px] font-semibold tabular-nums text-text">v{note.version}</span>
                {note.version === current && <span className="text-xs text-muted">{tr('(em uso)', '(current)')}</span>}
              </div>
              {note.date && <div className="mt-0.5 text-xs text-faint">{formatDate(note.date)}</div>}
              <ul className="mt-2 flex flex-col gap-1.5">
                {note.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-[18px] text-muted">
                    <KindIcon kind={item.kind} />
                    <span className="min-w-0">{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="flex justify-end border-t border-line px-5 py-2.5">
        <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] text-muted hover:text-text">
          {tr('Ver todas no GitHub', 'See all on GitHub')}
          <ExternalLink size={12} />
        </a>
      </footer>
    </Modal>
  )
}
