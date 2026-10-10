// Releases do GitHub: o que o atualizador lê deles. Lógica pura, sem rede (ver github.ts).

export type ReleaseAsset = { name: string; size: number; browser_download_url: string }
export type Release = {
  tag_name: string
  html_url: string
  draft?: boolean
  prerelease?: boolean
  assets: ReleaseAsset[]
}

// App do Mac (Apple Silicon), em .zip.
export const isMacAsset = (a: ReleaseAsset) => a.name.endsWith('-arm64.zip')
// Instalador do Windows publicado em cada release (ver electron-builder.yml).
export const isWindowsAsset = (a: ReleaseAsset) => /^Argus-Setup-[\d.]+\.exe$/.test(a.name)

export const releaseVersion = (release: Release) => release.tag_name.replace(/^v/, '')

// "0.10.0" > "0.9.3": compara número a número, não como texto.
export function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

export type Pick = { release: Release; asset: ReleaseAsset; version: string }

// O release mais novo que a versão em uso e que tem o arquivo pedido, ou null. Rascunhos e
// pré-lançamentos ficam de fora.
export function newestWith(releases: Release[], current: string, match: (a: ReleaseAsset) => boolean): Pick | null {
  let best: Pick | null = null
  for (const release of releases) {
    if (release.draft || release.prerelease) continue
    const version = releaseVersion(release)
    const asset = release.assets.find(match)
    if (!asset || !isNewer(version, current) || (best && !isNewer(version, best.version))) continue
    best = { release, asset, version }
  }
  return best
}

type Header = (name: string) => string | null

// Resposta de erro da API. 403/429 com o limite esgotado (60 consultas por hora por rede, sem
// login): diz quando o GitHub libera de novo.
export function apiFailure(status: number, header: Header): string {
  if ((status === 403 || status === 429) && header('x-ratelimit-remaining') === '0') {
    const reset = Number(header('x-ratelimit-reset'))
    const when = reset
      ? ` depois das ${new Date(reset * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : ' mais tarde'
    return `O GitHub limitou as consultas de atualização desta rede por enquanto. Tente de novo${when}.`
  }
  return `O GitHub respondeu ${status} ao procurar a versão nova.`
}
