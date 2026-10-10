import type { SpeechEvent } from '../../shared/speech'

export type Send = (event: SpeechEvent) => void
// stop: para de gravar e ainda entrega o fim do texto (até o "done"). abort: descarta tudo.
export type Session = { stop: () => void; abort: () => void }

// Microfone: o programa do Mac ou a janela, no Windows. stop: para de gravar. kill: descarta.
export type MicEvent = SpeechEvent | { type: 'audio'; chunk: Buffer }
export type Mic = { stop: () => void; kill: () => void }
export type OpenMic = (onEvent: (e: MicEvent) => void, onExit: (reason: string) => void) => Mic

// Áudio guardado enquanto a conexão (ou o login) não está pronta: 5 s em 16 kHz, 16 bits.
export const MAX_PENDING_BYTES = 160_000
