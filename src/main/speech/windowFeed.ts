import { MAX_PENDING_BYTES, type OpenMic } from './types'

// Windows: quem grava é a própria janela (ver preload/winMic), e o áudio chega aos pedaços por
// push. Ela já está gravando quando o ditado começa: o que chega enquanto o login é lido fica
// guardado e entra na sessão quando ela abre.
export class WindowFeed {
  private early: Buffer[] = []
  private earlyBytes = 0
  private sink: ((chunk: Buffer) => void) | null = null
  private closed = false

  push(chunk: Buffer): void {
    if (this.closed) return
    if (this.sink) return this.sink(chunk)
    if (this.earlyBytes >= MAX_PENDING_BYTES) return
    this.early.push(chunk)
    this.earlyBytes += chunk.length
  }

  // O microfone para a sessão do Claude: entrega o guardado e passa a repassar o que chegar.
  open: OpenMic = (onEvent) => {
    const flush = this.early
    this.early = []
    // Depois de a sessão terminar de montar: o primeiro áudio já encontra a conexão criada.
    queueMicrotask(() => {
      if (!this.closed) flush.forEach((chunk) => onEvent({ type: 'audio', chunk }))
    })
    this.sink = (chunk) => onEvent({ type: 'audio', chunk })
    const off = () => this.close()
    return { stop: off, kill: off }
  }

  // Parou de gravar ou foi descartado: o que chegar depois não vai a lugar nenhum.
  close(): void {
    this.closed = true
    this.sink = null
    this.early = []
  }
}
