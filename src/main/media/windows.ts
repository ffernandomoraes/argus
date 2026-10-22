import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { MediaCommand, NowPlaying } from '../../shared/media'
import { guardStdin } from '../lib/childProcess'
import { POWERSHELL } from '../winProcesses/system'
import type { MediaSource } from '.'

// Windows: a mídia do sistema (a que aparece junto do controle de volume), pela API
// GlobalSystemMediaTransportControls, e o volume da saída padrão, pelo Core Audio (trecho em C#,
// o PowerShell não tem comando para isso). Abrir um PowerShell a cada leitura levaria meio segundo:
// um só fica aberto e responde uma linha por pedido (get, toggle, next, previous, volume N).
// Precisa do Windows PowerShell 5.1: o PowerShell 7 não carrega os tipos do WinRT.

const SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float level, Guid ctx);
  int j();
  int GetMasterVolumeLevelScalar(out float level);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int ctx, int p, out IAudioEndpointVolume v); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator { }
public static class ArgusVolume {
  static IAudioEndpointVolume Endpoint() {
    IMMDevice d; IAudioEndpointVolume v; Guid id = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(((IMMDeviceEnumerator)new MMDeviceEnumerator()).GetDefaultAudioEndpoint(0, 1, out d));
    Marshal.ThrowExceptionForHR(d.Activate(ref id, 23, 0, out v));
    return v;
  }
  public static int Get() { float l; Marshal.ThrowExceptionForHR(Endpoint().GetMasterVolumeLevelScalar(out l)); return (int)Math.Round(l * 100); }
  public static void Set(int v) { Marshal.ThrowExceptionForHR(Endpoint().SetMasterVolumeLevelScalar(v / 100f, Guid.Empty)); }
}
"@
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq ('IAsyncOperation' + [char]96 + '1') } | Select-Object -First 1
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(3000) | Out-Null; $t.Result }
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
while ($null -ne ($line = [Console]::In.ReadLine())) {
  try {
    $cmd, $arg = $line -split ' ', 2
    $s = $manager.GetCurrentSession()
    switch ($cmd) {
      'get' {
        if (-not $s) { 'null'; break }
        $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $info = $s.GetPlaybackInfo()
        $playing = $info.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing
        $c = $info.Controls
        $canToggle = $c.IsPlayPauseToggleEnabled -or $c.IsPlayEnabled -or $c.IsPauseEnabled
        $duration = [int]($s.GetTimelineProperties().EndTime.TotalSeconds)
        @{ title = [string]$p.Title; artist = [string]$p.Artist; playing = $playing; canToggle = $canToggle; duration = $duration; volume = [ArgusVolume]::Get() } | ConvertTo-Json -Compress
      }
      'toggle' { if ($s) { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }; 'ok' }
      'next' { if ($s) { $null = Await ($s.TrySkipNextAsync()) ([bool]) }; 'ok' }
      'previous' { if ($s) { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }; 'ok' }
      'volume' { [ArgusVolume]::Set([int]$arg); 'ok' }
      default { 'null' }
    }
  } catch { 'null' }
}
`

let shell: ChildProcessWithoutNullStreams | null = null
// Pedidos esperando resposta, na ordem em que foram mandados: o PowerShell responde um por vez.
const waiting: ((line: string) => void)[] = []
// Depois de falhar algumas vezes seguidas (Windows sem a API, PowerShell bloqueado), desiste.
let failures = 0

function start(): ChildProcessWithoutNullStreams | null {
  if (shell) return shell
  if (failures >= 3) return null
  const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
  const child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true })
  // O pedido pode cair num PowerShell que acabou de sair: sem ouvinte, o EPIPE abriria a caixa de
  // erro do processo principal.
  guardStdin(child)
  child.stdout.setEncoding('utf8')
  createInterface({ input: child.stdout }).on('line', (line) => waiting.shift()?.(line.trim()))
  const end = () => {
    if (shell !== child) return
    shell = null
    failures++
    for (const resolve of waiting.splice(0)) resolve('null')
  }
  child.on('exit', end)
  child.on('error', end)
  shell = child
  return child
}

function ask(line: string): Promise<string> {
  const child = start()
  if (!child) return Promise.resolve('null')
  return new Promise((resolve) => {
    // A primeira resposta demora mais: o PowerShell ainda compila o trecho em C#.
    const timer = setTimeout(() => {
      // Sem resposta: o PowerShell travou. Fecha; o próximo pedido abre outro.
      child.kill()
    }, 15_000)
    waiting.push((answer) => {
      clearTimeout(timer)
      if (answer !== 'null') failures = 0
      resolve(answer)
    })
    child.stdin.write(`${line}\n`)
  })
}

export const windowsMedia: MediaSource = {
  async read() {
    return JSON.parse(await ask('get')) as NowPlaying | null
  },
  async command(command: MediaCommand) {
    await ask(command)
  },
  async setVolume(volume) {
    await ask(`volume ${volume}`)
  }
}
