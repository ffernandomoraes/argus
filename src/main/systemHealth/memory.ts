import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { freemem, totalmem } from 'node:os'
import type { MemoryInfo, MemoryLevel } from '../../shared/systemHealth'
import { IS_LINUX, IS_MAC } from '../platform'

// Quanta memória o computador tem disponível, pelo indicador que o próprio sistema usa. O Argus só
// encerra sessões paradas quando a máquina aperta de verdade (ver Chats); máquina com folga, mesmo
// com muita coisa aberta, fica como está. Leitura leve: o aviso da barra de cima confere a cada
// meio minuto (ver SystemHealth).

// Abaixo desta fração disponível, apertado.
const TIGHT_SHARE = 0.15
// Abaixo desta, chegando lá: o aviso amarelo na barra de cima.
const LOW_SHARE = 0.2
// Para sair de um nível, um pouco acima do limite: perto dele, o aviso não some e volta a cada leitura.
const MARGIN = 0.03

// share: a fração disponível. pressure: o aviso do próprio macOS (1 normal, 2 atenção, 4 crítico).
type Reading = { share: number; pressure?: number }

// Mac: o os.freemem() não serve (conta só as páginas vazias; deu 0,07 GB com 58% livre). O
// kern.memorystatus_level é o "free percentage" do memory_pressure.
function macReading(): Promise<Reading | null> {
  return new Promise((resolve) => {
    execFile('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level', 'kern.memorystatus_level'], { timeout: 3000 }, (err, out) => {
      const [pressure, freePercent] = out?.trim().split(/\s+/).map(Number) ?? []
      if (err || !Number.isFinite(pressure) || !Number.isFinite(freePercent)) return resolve(null)
      resolve({ share: freePercent / 100, pressure })
    })
  })
}

// Linux: MemAvailable, o que dá para usar sem tirar memória de ninguém (cache entra).
async function linuxReading(): Promise<Reading | null> {
  const text = await readFile('/proc/meminfo', 'utf8').catch(() => '')
  const kb = (name: string) => Number(new RegExp(`^${name}:\\s+(\\d+)`, 'm').exec(text)?.[1])
  const available = kb('MemAvailable')
  const total = kb('MemTotal')
  return available > 0 && total > 0 ? { share: available / total } : null
}

// Windows: o os.freemem() já é a memória disponível do sistema (a "Disponível" do Gerenciador de Tarefas).
const windowsReading = (): Reading => ({ share: freemem() / totalmem() })

// O nível pela fração disponível. `previous`: o da leitura anterior, para a folga de saída.
export function memoryLevel(share: number, pressure = 0, previous: MemoryLevel = 'ok'): MemoryLevel {
  if (pressure >= 2 || share < (previous === 'tight' ? TIGHT_SHARE + MARGIN : TIGHT_SHARE)) return 'tight'
  if (share < (previous === 'ok' ? LOW_SHARE : LOW_SHARE + MARGIN)) return 'low'
  return 'ok'
}

// Nulo: não deu para saber.
export async function readMemory(previous?: MemoryLevel): Promise<MemoryInfo | null> {
  const r = IS_MAC ? await macReading() : IS_LINUX ? await linuxReading() : windowsReading()
  if (!r) return null
  const totalBytes = totalmem()
  return { availableBytes: Math.round(totalBytes * r.share), totalBytes, level: memoryLevel(r.share, r.pressure, previous) }
}

// Nulo: não deu para saber (aí nada encerra por memória).
export async function memoryTight(): Promise<boolean | null> {
  const m = await readMemory()
  return m ? m.level === 'tight' : null
}
