import type { ReleaseNote, ReleaseNoteKind } from '../../shared/updates'
import { fetchRecentReleases } from './github'
import { releaseVersion, type Release } from './releases'

const KINDS: Record<string, ReleaseNoteKind> = { BUG: 'bug', MELHORIA: 'improvement', FUNCIONALIDADE: 'feature' }

// Uma mudança por linha "- ", com a etiqueta na frente (ver o passo "Publicar release" do
// .github/workflows/release.yml). Release escrito à mão, sem lista: cada linha vira um item.
export function parseNotes(body: string): ReleaseNote['items'] {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const bullets = lines.filter((l) => /^[-*] /.test(l))
  return (bullets.length ? bullets.map((l) => l.slice(2).trim()) : lines).map((line) => {
    const m = /^\[([^\]]+)\]\s*/.exec(line)
    const kind = m ? (KINDS[m[1].toUpperCase()] ?? null) : null
    return { kind, text: kind ? line.slice(m![0].length) : line }
  })
}

const toNote = (r: Release): ReleaseNote => ({
  version: releaseVersion(r),
  date: r.published_at ?? null,
  url: r.html_url,
  items: parseNotes(r.body ?? '')
})

// As últimas versões publicadas, da mais nova para a mais velha. Mesma consulta do atualizador:
// o ETag guardado faz a repetição não contar no limite do GitHub.
export async function fetchReleaseNotes(count = 5): Promise<ReleaseNote[]> {
  const releases = await fetchRecentReleases()
  return releases.filter((r) => !r.draft && !r.prerelease).slice(0, count).map(toNote)
}
