import { useRef, type ChangeEvent } from 'react'
import { ImagePlus, Mic, Paperclip, SendHorizontal, Square } from 'lucide-react'
import { IconButton } from '../../ui/IconButton'
import type { DictationState } from '../useDictation'
import { VoiceWave } from '../VoiceWave'

// Linha de baixo da caixa de escrever: anexar imagem ou arquivo, ditado e enviar (ou parar, com o
// Claude trabalhando e nada para enviar).
export function ComposerActions({
  onFiles,
  dictation,
  onToggleDictation,
  stopping,
  onStop,
  onSend,
  sendDisabled
}: {
  onFiles: (files: FileList) => void
  dictation: DictationState
  onToggleDictation: () => void
  // Mostra o Parar no lugar do Enviar.
  stopping: boolean
  onStop: () => void
  onSend: () => void
  sendDisabled: boolean
}) {
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(e.target.files)
    e.target.value = ''
  }
  const dictating = dictation !== 'idle'

  return (
    <div className="flex items-center gap-1 px-2 pb-2">
      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={onPick} />
      <input ref={fileInput} type="file" multiple hidden onChange={onPick} />
      <IconButton label="Anexar imagem" onClick={() => imageInput.current?.click()}>
        <ImagePlus size={15} />
      </IconButton>
      <IconButton label="Anexar arquivo" onClick={() => fileInput.current?.click()}>
        <Paperclip size={15} />
      </IconButton>
      <span className="flex-1" />
      {dictating && (
        <span className="mr-1 flex items-center gap-2 text-[12px] text-running">
          {dictation === 'listening' ? <VoiceWave /> : 'Ligando…'}
        </span>
      )}
      {/* Microfone ligado tem cor própria (sem variante na base). */}
      <button
        aria-label={dictating ? 'Parar ditado' : 'Ditar por voz'}
        title={dictating ? 'Parar ditado' : 'Ditar por voz'}
        onClick={onToggleDictation}
        className={`mr-1 flex size-7 items-center justify-center rounded-md ${
          dictating ? 'bg-running/15 text-running hover:bg-running/25' : 'text-muted hover:bg-surface-2 hover:text-text'
        }`}
      >
        <Mic size={15} />
      </button>
      {stopping ? (
        <IconButton label="Parar" variant="primary" onClick={onStop}>
          <Square size={11} fill="currentColor" />
        </IconButton>
      ) : (
        <IconButton label="Enviar" title="Enviar (Enter)" variant="primary" onClick={onSend} disabled={sendDisabled}>
          <SendHorizontal size={14} />
        </IconButton>
      )}
    </div>
  )
}
