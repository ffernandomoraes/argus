import { IS_LINUX, IS_MAC, IS_WIN } from '../platform'
import type { MediaCommand, NowPlaying } from '../../shared/media'
import { linuxMedia } from './linux'
import { macMedia } from './mac'
import { windowsMedia } from './windows'

// O que toca no sistema, de qualquer app (Spotify, uma aba do navegador...), e os controles dele.
// Cada sistema tem a sua fonte: o "Tocando agora" do Mac, a mídia do Windows (a do controle de
// volume) e o MPRIS do Linux. Sem nada tocando, ou sem como ler, nowPlaying devolve nulo e a
// barra não mostra o player.
//
// Som de notificação não conta: apps feitos em navegador (Teams, Slack) publicam cada aviso como
// mídia, que fica ali parada depois de tocar. Tocar de novo só repete o aviso.
const NOTIFICATION_MAX_S = 30

export type MediaSource = {
  read(): Promise<NowPlaying | null>
  command(command: MediaCommand): Promise<void>
  setVolume(volume: number): Promise<void>
}

const source: MediaSource | null = IS_MAC ? macMedia : IS_WIN ? windowsMedia : IS_LINUX ? linuxMedia : null

export async function nowPlaying(): Promise<NowPlaying | null> {
  try {
    const media = await source?.read()
    if (!media?.title) return null
    if (!media.playing && media.duration > 0 && media.duration < NOTIFICATION_MAX_S) return null
    return media
  } catch {
    return null
  }
}

export async function mediaCommand(command: MediaCommand): Promise<void> {
  await source?.command(command).catch(() => {})
}

export async function setVolume(volume: number): Promise<void> {
  await source?.setVolume(Math.max(0, Math.min(100, Math.round(volume)))).catch(() => {})
}
