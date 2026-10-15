import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { freemem, totalmem } from 'node:os'
import { IS_LINUX, IS_MAC } from '../platform'

// O computador está com pouca memória? Pergunta ao próprio sistema, pelo indicador que ele usa: o
// Argus só encerra sessões paradas quando a máquina aperta de verdade (ver Chats). Máquina com
// folga, mesmo com muita coisa aberta, fica como está. Leitura leve, para conferir a cada minuto.

// Abaixo desta fração de memória disponível, conta como apertado.
const TIGHT_SHARE = 0.15

// Mac: o os.freemem() não serve (conta só as páginas vazias; deu 0,07 GB com 58% livre). O
// kern.memorystatus_level é o "free percentage" do memory_pressure, e o pressure_level é o aviso do
// próprio macOS (1 normal, 2 atenção, 4 crítico).
function macTight(): Promise<boolean | null> {
  return new Promise((resolve) => {
    execFile('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level', 'kern.memorystatus_level'], { timeout: 3000 }, (err, out) => {
      const [pressure, freePercent] = out?.trim().split(/\s+/).map(Number) ?? []
      if (err || !Number.isFinite(pressure) || !Number.isFinite(freePercent)) return resolve(null)
      resolve(pressure >= 2 || freePercent < TIGHT_SHARE * 100)
    })
  })
}

// Linux: MemAvailable, o que dá para usar sem tirar memória de ninguém (cache entra).
async function linuxTight(): Promise<boolean | null> {
  const text = await readFile('/proc/meminfo', 'utf8').catch(() => '')
  const kb = (name: string) => Number(new RegExp(`^${name}:\\s+(\\d+)`, 'm').exec(text)?.[1])
  const available = kb('MemAvailable')
  const total = kb('MemTotal')
  return available > 0 && total > 0 ? available / total < TIGHT_SHARE : null
}

// Windows: o os.freemem() já é a memória disponível do sistema.
const windowsTight = (): boolean => freemem() / totalmem() < TIGHT_SHARE

// Nulo: não deu para saber (aí nada encerra por memória).
export function memoryTight(): Promise<boolean | null> {
  if (IS_MAC) return macTight()
  if (IS_LINUX) return linuxTight()
  return Promise.resolve(windowsTight())
}
