import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useStore } from '../../lib/useStore'
import { ExperimentTag } from '../../ui/ExperimentTag'
import { tr } from '../../i18n'
import { cancelDownload, downloadModel, modelStore, retryTranscript, skipTranscript, transcriptStore } from './transcripts'

const megabytes = (bytes: number) => Math.round(bytes / 1_000_000)

const LINK = 'text-accent hover:underline'

// Linha embaixo do nome de um áudio anexado: a pergunta para baixar o modelo, o download, a
// transcrição andando ou o texto pronto (inteiro no title). Áudio sem transcrição ligada: nada.
export function AudioStatus({ file }: { file: File }) {
  const transcript = useStore(transcriptStore, (map) => map.get(file))
  const model = useStore(modelStore)
  if (!transcript) return null

  const row = (children: ReactNode, title?: string) => (
    <div title={title} className="flex min-w-0 items-center gap-1.5 text-[11px] text-faint">
      <ExperimentTag />
      {children}
    </div>
  )

  const size = model?.status === 'missing' ? `${megabytes(model.total)} MB` : '~300 MB'

  switch (transcript.status) {
    case 'asking':
      return row(
        <>
          <span className="truncate">
            {model?.status === 'error'
              ? model.message
              : tr(`Transcrever? Baixa o modelo uma vez (${size})`, `Transcribe? Downloads the model once (${size})`)}
          </span>
          <button className={`shrink-0 ${LINK}`} onClick={downloadModel}>
            {model?.status === 'error' ? tr('Tentar de novo', 'Try again') : tr('Baixar', 'Download')}
          </button>
          <button className="shrink-0 hover:text-text hover:underline" onClick={() => skipTranscript(file)}>
            {tr('Agora não', 'Not now')}
          </button>
        </>
      )
    case 'waiting': {
      if (model?.status !== 'downloading') return row(<Loader2 size={11} className="animate-spin" />)
      const percent = model.total ? Math.floor((model.received / model.total) * 100) : 0
      return row(
        <>
          <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
          </div>
          <span className="truncate">{tr(`Baixando modelo - ${percent}%`, `Downloading model - ${percent}%`)}</span>
          <button className="shrink-0 hover:text-text hover:underline" onClick={cancelDownload}>
            {tr('Cancelar', 'Cancel')}
          </button>
        </>
      )
    }
    case 'transcribing':
      return row(
        <>
          <Loader2 size={11} className="shrink-0 animate-spin" />
          <span className="truncate">{tr('Transcrevendo…', 'Transcribing…')}</span>
        </>
      )
    case 'done':
      return row(<span className="truncate text-muted">{transcript.text ? `"${transcript.text}"` : tr('Nenhuma fala reconhecida', 'No speech recognized')}</span>, transcript.text)
    case 'error':
      return row(
        <>
          <span className="truncate">{tr('Não deu para transcrever', 'Couldn’t transcribe')}</span>
          <button className={`shrink-0 ${LINK}`} onClick={() => retryTranscript(file)}>
            {tr('Tentar de novo', 'Try again')}
          </button>
        </>,
        transcript.message
      )
    case 'skipped':
      return row(<span className="truncate">{tr('Vai sem transcrição', 'Sent without transcript')}</span>)
  }
}
