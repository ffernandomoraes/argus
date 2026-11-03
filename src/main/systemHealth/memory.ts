import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { freemem, totalmem } from 'node:os'
import type { MemoryInfo, MemoryLevel } from '../../shared/systemHealth'
import { IS_LINUX, IS_MAC } from '../platform'

// Quanta memória o computador tem disponível: a livre mais a que o sistema libera na hora (o cache
// de arquivos), como o Monitor de Atividade e o Gerenciador de Tarefas contam. O Argus só encerra
// sessões paradas quando a máquina aperta de verdade (ver Chats); máquina com folga, mesmo com
// muita coisa aberta, fica como está. Leitura leve: o aviso da barra de cima confere a cada meio
// minuto (ver SystemHealth).

// Abaixo desta fração disponível, apertado: o aviso vermelho, e as conversas paradas fora da tela fecham.
const TIGHT_SHARE = 0.1
// Abaixo desta, chegando lá: o aviso amarelo na barra de cima.
const LOW_SHARE = 0.15
// Para sair de um nível, um pouco acima do limite: perto dele, o aviso não some e volta a cada leitura.
const MARGIN = 0.03

// O aviso de memória do próprio macOS (kern.memorystatus_vm_pressure_level): 1 normal, 2 atenção,
// 4 crítico, os níveis do gráfico de Pressão de Memória do Monitor de Atividade (verde, amarelo e
// vermelho). Aqui, as mesmas cores. Até 2026-11-03 a atenção já era o vermelho e fechava conversas:
// o Argus avisava um nível acima do macOS.
const PRESSURE_WARN = 2
const PRESSURE_CRITICAL = 4

// share: a fração disponível. pressure: o aviso do próprio macOS (ver PRESSURE_WARN).
export type Reading = { share: number; pressure?: number }

// Mac: a livre, o cache de arquivos e a memória que os apps marcaram como descartável (purgeable):
// o que o Monitor de Atividade não conta como Memória Usada. Não serve o kern.memorystatus_level (o
// "free percentage" do memory_pressure), que conta como livre a memória em uso pelos apps: é quase
// 100% menos a reservada pelo sistema e a comprimida. Medido em 2026-11-03: com 2 GB a mais em uso,
// ele foi de 68% para 66%, e esta conta, de 32% para 21%. Nem o os.freemem(), que conta só as
// páginas vazias (deu 0,07 GB com 58% livre).
const MAC_SYSCTLS = ['kern.memorystatus_vm_pressure_level', 'hw.pagesize', 'vm.page_free_count', 'vm.page_pageable_external_count', 'vm.page_purgeable_count']

// A saída do sysctl -n, um número por linha na ordem de MAC_SYSCTLS. Nulo: faltou algum.
export function macReadingOf(out: string, totalBytes: number): Reading | null {
  const values = out.trim().split(/\s+/).map(Number)
  if (values.length !== MAC_SYSCTLS.length || !values.every(Number.isFinite) || totalBytes <= 0) return null
  const [pressure, pageSize, free, fileCache, purgeable] = values
  return { share: Math.min(1, ((free + fileCache + purgeable) * pageSize) / totalBytes), pressure }
}

function macReading(): Promise<Reading | null> {
  return new Promise((resolve) => {
    execFile('/usr/sbin/sysctl', ['-n', ...MAC_SYSCTLS], { timeout: 3000 }, (err, out) => resolve(err ? null : macReadingOf(out, totalmem())))
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

// O nível pela fração disponível e pelo aviso do macOS, o que for mais grave. `previous`: o da
// leitura anterior, para a folga de saída.
export function memoryLevel(share: number, pressure = 0, previous: MemoryLevel = 'ok'): MemoryLevel {
  if (pressure >= PRESSURE_CRITICAL || share < (previous === 'tight' ? TIGHT_SHARE + MARGIN : TIGHT_SHARE)) return 'tight'
  if (pressure >= PRESSURE_WARN || share < (previous === 'ok' ? LOW_SHARE : LOW_SHARE + MARGIN)) return 'low'
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
