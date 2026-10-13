import { execFile } from 'node:child_process'
import type { MediaCommand, NowPlaying } from '../../shared/media'
import type { MediaSource } from '.'

// Mac: o MediaRemote, framework privado da Apple por trás do "Tocando agora" da Central de
// Controle. Desde o macOS 15.4 ele só responde a programas da Apple, por isso tudo passa pelo
// osascript. O volume é o de saída do sistema.

const LOAD = 'ObjC.import("Foundation"); $.NSBundle.bundleWithPath("/System/Library/PrivateFrameworks/MediaRemote.framework/").load;'

const READ = `${LOAD}
const info = $.NSClassFromString("MRNowPlayingRequest").localNowPlayingItem.nowPlayingInfo;
const get = (k) => { const v = info.objectForKey("kMRMediaRemoteNowPlayingInfo" + k); return v.isNil() ? null : ObjC.unwrap(v) };
const app = Application.currentApplication(); app.includeStandardAdditions = true;
JSON.stringify(info.isNil() ? null : { title: get("Title") || "", artist: get("Artist") || "", playing: get("PlaybackRate") > 0, volume: app.getVolumeSettings().outputVolume })`

// Códigos do MRMediaRemoteSendCommand. O envio não espera resposta: sem o delay, o osascript sai
// antes de o comando chegar ao sistema e nada acontece.
const COMMANDS: Record<MediaCommand, number> = { toggle: 2, next: 4, previous: 5 }

function jxa(script: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('osascript', ['-l', 'JavaScript', '-e', script], { timeout: 3000 }, (err, stdout) => resolve(err ? '' : stdout.trim()))
  })
}

export const macMedia: MediaSource = {
  async read() {
    return JSON.parse((await jxa(READ)) || 'null') as NowPlaying | null
  },
  async command(command) {
    await jxa(`${LOAD} ObjC.bindFunction("MRMediaRemoteSendCommand", ["bool", ["int", "id"]]); $.MRMediaRemoteSendCommand(${COMMANDS[command]}, $()); delay(0.3)`)
  },
  async setVolume(volume) {
    await jxa(`const a = Application.currentApplication(); a.includeStandardAdditions = true; a.setVolume(null, { outputVolume: ${volume} })`)
  }
}
