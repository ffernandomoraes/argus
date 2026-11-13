// Ditado tem um dono por janela: o campo que começou. Os eventos do ditado chegam para a janela
// inteira, e sem dono o texto caía em todos os campos que já tinham ditado (o drawer e o bloco no
// canvas, por exemplo). Começar em outro campo devolve o anterior para parado.

// flushing: já parou de gravar, mas o fim do texto ainda pode chegar.
export type DictationPhase = 'off' | 'on' | 'flushing'

export type DictationSession = {
  phase: DictationPhase
  // Volta o campo para parado (quando outro campo começa a ditar).
  idle: () => void
}

let owner: DictationSession | null = null

export function createDictationSession(idle: () => void): DictationSession {
  return { phase: 'off', idle }
}

// Este campo passa a ser o dono; o anterior para de receber e volta para parado.
export function claimDictation(session: DictationSession): void {
  if (owner && owner !== session) {
    owner.phase = 'off'
    owner.idle()
  }
  owner = session
  session.phase = 'on'
}

export function setDictationPhase(session: DictationSession, phase: DictationPhase): void {
  session.phase = phase
}

// Só o dono, e só enquanto espera texto, recebe os eventos.
export const listensToDictation = (session: DictationSession) => owner === session && session.phase !== 'off'

// O campo saiu da tela: deixa de ser o dono. Devolve se ele ainda estava gravando.
export function releaseDictation(session: DictationSession): boolean {
  const recording = owner === session && session.phase === 'on'
  if (owner === session) owner = null
  session.phase = 'off'
  return recording
}
