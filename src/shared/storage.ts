// O espaço que as conversas e os rascunhos do agente ocupam, e a limpeza automática (ver
// main/storage). A aba Armazenamento das Configurações mostra e muda os prazos.

export type StorageSettings = {
  // Conversas sem atividade há mais que isso, em dias, são apagadas inteiras (texto, prints e
  // anexos). É o cleanupPeriodDays do Claude Code, guardado no settings.json dele.
  conversationDays: number
  // Rascunhos do agente (repositórios clonados, saídas de comandos, arquivos de trabalho) de
  // conversas paradas há mais que isso, em dias, são apagados.
  scratchDays: number
  // Conversas sem atividade há mais que isso, em dias, perdem os prints e anexos; o texto fica. Nunca
  // maior que conversationDays: a conversa sumiria antes (ver withMediaCap).
  mediaDays: number
}

export const STORAGE_DEFAULTS: StorageSettings = { conversationDays: 90, scratchDays: 7, mediaDays: 60 }

// O que uma limpeza liberou.
export type CleanResult = { at: number; freedBytes: number; scratchRemoved: number; conversationsTrimmed: number }

export type StorageUsage = {
  conversations: number
  conversationsBytes: number
  // Nulo: ainda medindo (a pasta dos rascunhos pode ter milhões de arquivos).
  scratchBytes: number | null
  scratchSessions: number
  lastClean: CleanResult | null
  running: boolean
}

// O prazo dos prints vai até o das conversas: com o das conversas menor, os dois ficam iguais.
export function withMediaCap(s: StorageSettings): StorageSettings {
  return s.mediaDays > s.conversationDays ? { ...s, mediaDays: s.conversationDays } : s
}
