// Memória e disco do computador, para o aviso na barra de cima (ver main/systemHealth): quanto está
// disponível e o que parou por falta deles.

// tight: o Argus fecha as conversas paradas fora da tela, e o sistema pode encerrar o que roda.
export type MemoryLevel = 'ok' | 'low' | 'tight'
// full: gravar começa a falhar (o canvas, as conversas).
export type DiskLevel = 'ok' | 'low' | 'full'

export type MemoryInfo = { availableBytes: number; totalBytes: number; level: MemoryLevel }
export type DiskInfo = { freeBytes: number; totalBytes: number; level: DiskLevel }

// O que teve de parar por falta de memória ou de disco:
// - chatClosed: o Argus fechou uma conversa parada, fora da tela, para liberar memória;
// - claudeStopped: o sistema encerrou o Claude de uma conversa (busy: no meio de uma resposta);
// - windowCrashed: a janela do canvas caiu sem memória;
// - diskFull: uma gravação falhou com o disco cheio.
export type HealthEventKind = 'chatClosed' | 'claudeStopped' | 'windowCrashed' | 'diskFull'

export type HealthEvent = { id: string; kind: HealthEventKind; at: number; cwd?: string; sessionId?: string; busy?: boolean }

export type SystemHealthState = {
  // Nulo: não deu para ler.
  memory: MemoryInfo | null
  disk: DiskInfo | null
  // Até você dar "Entendi" no aviso.
  events: HealthEvent[]
  // Conversas fechadas para liberar memória que ainda não voltaram a trabalhar: ganham uma linha
  // explicando por que a primeira resposta demora.
  freed: string[]
}
