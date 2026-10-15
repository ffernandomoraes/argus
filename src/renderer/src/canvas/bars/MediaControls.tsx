import { memo, useEffect, useRef, useState } from 'react'
import { Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import type { NowPlaying } from '../../../../shared/media'
import { Presence } from '../../motion'
import { MenuArrow } from '../../ui/MenuArrow'
import { MENU_PANEL } from '../../ui/menuStyles'
import { useEscape } from '../../useEscape'
import { useOutsideClick } from '../../useOutsideClick'
import { tr } from '../../i18n'

// De quanto em quanto tempo confere o que toca no sistema. Só com a janela à vista.
const POLL_MS = 2000

// Player na barra de título, ao lado dos botões da janela: o nome da música, tocar/pausar e o
// volume do sistema, de qualquer app (Spotify, uma aba do navegador; ver main/media). Sem nada
// tocando, ou desligado nas configurações, não aparece. O botão de tocar/pausar só aparece se o
// app aceita o comando. O volume é um ícone; o controle abre num
// painel abaixo, ao clicar. Sem dicas ao passar o mouse: os controles se explicam pelo ícone.

const CONTROL = 'flex h-6 min-w-6 items-center justify-center rounded-md'
const tone = (on: boolean) => (on ? 'bg-fill text-text ring-1 ring-line ring-inset' : 'text-muted hover:bg-fill hover:text-text')
export const MediaControls = memo(function MediaControls() {
  const [media, setMedia] = useState<NowPlaying | null>(null)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const volumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Ícone e painel num elemento só: o clique no ícone não conta como fora.
  const volumeRef = useRef<HTMLDivElement>(null)
  useOutsideClick(volumeRef, () => setVolumeOpen(false), volumeOpen)
  useEscape(() => setVolumeOpen(false), volumeOpen)

  useEffect(() => {
    let alive = true
    const read = () => {
      if (document.hidden) return
      void window.api.media.get().then((m) => alive && setMedia(m))
    }
    read()
    const id = setInterval(read, POLL_MS)
    document.addEventListener('visibilitychange', read)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', read)
    }
  }, [])

  if (!media) return null

  // O ícone muda na hora; a próxima leitura confirma.
  const toggle = () => {
    setMedia({ ...media, playing: !media.playing })
    void window.api.media.command('toggle')
  }

  // Cada passo do arraste chamaria o osascript: manda só quando o arraste para.
  const changeVolume = (volume: number) => {
    setMedia({ ...media, volume })
    clearTimeout(volumeTimer.current)
    volumeTimer.current = setTimeout(() => void window.api.media.setVolume(volume), 120)
  }

  const VolumeIcon = media.volume === 0 ? VolumeX : media.volume < 50 ? Volume1 : Volume2
  return (
    <div className="no-drag flex items-center gap-1.5">
      {media.canToggle && (
        <button aria-label={media.playing ? tr('Pausar', 'Pause') : tr('Tocar', 'Play')} onClick={toggle} className={`${CONTROL} ${tone(false)}`}>
          {media.playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      )}
      <span className="max-w-40 truncate text-[12px] text-muted">{media.title}</span>
      <div ref={volumeRef} className="relative flex items-center">
        <button aria-label={tr('Volume', 'Volume')} aria-expanded={volumeOpen} onClick={() => setVolumeOpen((o) => !o)} className={`${CONTROL} ${tone(volumeOpen)}`}>
          <VolumeIcon size={14} />
        </button>
        <Presence kind="menu">
          {volumeOpen && (
            <div className={`absolute left-0 top-full mt-2.5 flex items-center gap-2 px-3 py-2 ${MENU_PANEL}`}>
              <MenuArrow side="top" at={12} />
              <input
                type="range"
                min={0}
                max={100}
                value={media.volume}
                aria-label={tr('Volume', 'Volume')}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="h-1 w-28 accent-accent"
              />
              <span className="w-7 text-right text-[11px] text-muted tabular-nums">{media.volume}</span>
            </div>
          )}
        </Presence>
      </div>
    </div>
  )
})
