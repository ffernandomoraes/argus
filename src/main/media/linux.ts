import { execFile } from 'node:child_process'
import type { MediaCommand } from '../../shared/media'
import type { MediaSource } from '.'

// Linux: o MPRIS, padrão pelo qual os players (Spotify, VLC, Chrome, Firefox) se mostram no D-Bus,
// lido com o gdbus (vem com o GLib, presente no GNOME e no KDE). O volume é o da saída padrão: pelo
// wpctl (PipeWire) ou, sem ele, pelo pactl (PulseAudio).

const MPRIS = 'org.mpris.MediaPlayer2.'

// Nulo quando o programa falha ou não existe.
function run(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => execFile(cmd, args, { timeout: 3000 }, (err, stdout) => resolve(err ? null : stdout)))
}

const call = async (dest: string, path: string, method: string, ...args: string[]) =>
  (await run('gdbus', ['call', '--session', '--dest', dest, '--object-path', path, '--method', method, ...args])) ?? ''

// Texto de uma chave na saída do gdbus (formato GVariant): 'chave': <'valor'> ou <['valor']>.
// Valor com aspa simples vem entre aspas duplas.
function field(out: string, key: string): string {
  const m = out.match(new RegExp(`'${key}': <\\[?(['"])((?:\\\\.|(?!\\1).)*)\\1`))
  return m ? m[2].replace(/\\(.)/g, '$1') : ''
}

// Players abertos, o que toca primeiro. O comando vai para o último mostrado na barra.
let current = ''

async function players(): Promise<{ name: string; info: string; playing: boolean }[]> {
  const names = (await call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus.ListNames')).match(/org\.mpris\.MediaPlayer2\.[^']+/g) ?? []
  const all = await Promise.all(
    names.map(async (name) => {
      const info = await call(name, '/org/mpris/MediaPlayer2', 'org.freedesktop.DBus.Properties.GetAll', `${MPRIS}Player`)
      return { name, info, playing: field(info, 'PlaybackStatus') === 'Playing' }
    })
  )
  return all.filter((p) => field(p.info, 'xesam:title')).sort((a, b) => Number(b.playing) - Number(a.playing))
}

async function readVolume(): Promise<number> {
  const wp = (await run('wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@']))?.match(/Volume:\s*([\d.]+)/)
  if (wp) return Math.round(Number(wp[1]) * 100)
  const pa = (await run('pactl', ['get-sink-volume', '@DEFAULT_SINK@']))?.match(/(\d+)%/)
  return pa ? Number(pa[1]) : 0
}

const METHODS: Record<MediaCommand, string> = { toggle: 'PlayPause', next: 'Next', previous: 'Previous' }

export const linuxMedia: MediaSource = {
  async read() {
    const [player] = await players()
    if (!player) return null
    current = player.name
    return {
      title: field(player.info, 'xesam:title'),
      artist: field(player.info, 'xesam:artist'),
      playing: player.playing,
      volume: await readVolume()
    }
  },
  async command(command) {
    if (current) await call(current, '/org/mpris/MediaPlayer2', `${MPRIS}Player.${METHODS[command]}`)
  },
  async setVolume(volume) {
    const done = await run('wpctl', ['set-volume', '@DEFAULT_AUDIO_SINK@', String(volume / 100)])
    if (done === null) await run('pactl', ['set-sink-volume', '@DEFAULT_SINK@', `${volume}%`])
  }
}
