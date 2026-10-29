import { useEffect, useRef, useState } from 'react'
import type { TaskOutputRef } from '../../../shared/backgroundTasks'
import type { Xterm } from './terminal/createXterm'
import { fontSizeFor, TERMINAL_THEME } from './terminal/theme'
import { loadXterm } from './terminal/useXterm'
import { tr } from '../i18n'

// Rodando, a saída é relida a cada intervalo: o processo principal lê só o que o arquivo ganhou.
const POLL_MS = 1000
// Esconde o cursor: ninguém digita aqui.
const HIDE_CURSOR = '\x1b[?25l'

type Reader = { read: () => void; setFontSize: (px: number) => void }

// Saída de uma tarefa em segundo plano num terminal só para ler: as cores e a formatação do
// comando ficam, dá para selecionar e copiar, e não dá para digitar. Não há processo por trás: o
// texto vem do arquivo que o Claude Code grava (ver main/tasks/output.ts).
export function TaskOutputView({ task, running, fontScale = 1 }: { task: TaskOutputRef; running: boolean; fontScale?: number }) {
  const el = useRef<HTMLDivElement>(null)
  const reader = useRef<Reader | null>(null)
  const [missing, setMissing] = useState(false)
  const { cwd, sessionId, taskId, outputFile } = task
  // Escala na hora de criar o terminal; as trocas depois só ajustam a fonte (efeito de baixo).
  const scale = useRef(fontScale)

  // Um terminal por tarefa; a leitura continua de onde parou.
  useEffect(() => {
    const host = el.current
    if (!host) return
    let disposed = false
    let xterm: Xterm | null = null
    let offset = 0
    let reading = false
    let again = false
    const ref: TaskOutputRef = { cwd, sessionId, taskId, outputFile }
    const read = () => {
      if (disposed || !xterm) return
      if (reading) {
        again = true
        return
      }
      reading = true
      window.api.sessions
        .taskOutput(ref, offset)
        .then((chunk) => {
          if (disposed || !xterm) return
          if (chunk.reset) {
            xterm.term.reset()
            xterm.term.write(HIDE_CURSOR)
          }
          offset = chunk.offset
          if (chunk.text) xterm.term.write(chunk.text)
          setMissing(chunk.missing)
        })
        .catch(() => {})
        .finally(() => {
          reading = false
          if (again) {
            again = false
            read()
          }
        })
    }
    void loadXterm().then(({ createXterm }) => {
      if (disposed) return
      xterm = createXterm(host, fontSizeFor(scale.current), false)
      // O arquivo tem só "\n": sem isso, cada linha começaria onde a anterior parou.
      xterm.term.options.convertEol = true
      xterm.term.options.disableStdin = true
      xterm.term.options.cursorBlink = false
      xterm.term.write(HIDE_CURSOR)
      reader.current = { read, setFontSize: (px) => xterm?.setFontSize(px) }
      read()
    })
    return () => {
      disposed = true
      reader.current = null
      xterm?.dispose()
    }
  }, [cwd, sessionId, taskId, outputFile])

  // Rodando, relê de tempos em tempos; ao parar, uma última vez (o fim da saída).
  useEffect(() => {
    if (!running) return reader.current?.read()
    const timer = setInterval(() => reader.current?.read(), POLL_MS)
    return () => clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (scale.current === fontScale) return
    scale.current = fontScale
    reader.current?.setFontSize(fontSizeFor(fontScale))
  }, [fontScale])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ background: TERMINAL_THEME.background }}>
      {/* O respiro fica no invólucro: o encaixe do xterm mede o elemento dele inteiro. */}
      <div className="min-h-0 flex-1 px-3 py-2">
        <div ref={el} className="h-full" />
      </div>
      {missing && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-faint">
          {running
            ? tr('Esperando a primeira saída…', 'Waiting for the first output…')
            : tr('A saída desta tarefa não foi encontrada. O sistema pode ter apagado a pasta temporária.', 'This task’s output wasn’t found. The system may have cleared the temporary folder.')}
        </div>
      )}
    </div>
  )
}
