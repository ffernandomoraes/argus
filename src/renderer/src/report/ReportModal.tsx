import { useEffect, useState } from 'react'
import { Check, Copy, LifeBuoy, Loader2 } from 'lucide-react'
import type { ReportState } from '../../../shared/report'
import { INPUT } from '../agents/Field'
import { useCopied } from '../lib/useCopied'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { tr } from '../i18n'
import type { ReportRequest } from './reportStore'
import { useReportState } from './useReportState'

// Reportar problema, em três momentos: a pessoa conta o que aconteceu; o Claude dela investiga
// (dá para fechar e voltar, a investigação segue no processo principal); o relatório fica pronto
// para copiar e mandar. Aberto por um erro novo, começa do formulário, mesmo que haja um relatório
// antigo pronto.
export function ReportModal({ request, onClose }: { request: ReportRequest; onClose: () => void }) {
  const state = useReportState()

  useEffect(() => {
    if (request.error) window.api.report.reset()
  }, [request.error])

  return (
    <Modal label={tr('Reportar problema', 'Report a problem')} variant="blocking" closeOnBackdrop size="md" className="flex flex-col" onClose={onClose}>
      <header className="flex items-start gap-3 border-b border-line px-5 py-3">
        <LifeBuoy size={15} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{tr('Reportar problema', 'Report a problem')}</div>
          <div className="mt-0.5 text-[12px] text-faint">
            {tr(
              'O Claude da sua conta investiga e monta um relatório para você mandar ao desenvolvedor.',
              'Your Claude account investigates and writes a report for you to send to the developer.'
            )}
          </div>
        </div>
        <ModalCloseButton />
      </header>
      {state.status === 'running' ? (
        <Running state={state} />
      ) : state.status === 'done' ? (
        <Done state={state} onClose={onClose} />
      ) : (
        <Form request={request} onClose={onClose} />
      )}
    </Modal>
  )
}

function Form({ request, onClose }: { request: ReportRequest; onClose: () => void }) {
  const [description, setDescription] = useState('')
  const ready = !!description.trim() || !!request.error

  return (
    <>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4">
        {request.error && (
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-muted">{tr('Erro', 'Error')}</div>
            <pre className="max-h-32 overflow-auto rounded-md border border-line bg-bg px-3 py-2 font-mono text-[12px] whitespace-pre-wrap text-red-400">
              {request.error}
            </pre>
          </div>
        )}
        <label className="flex flex-col">
          <span className="mb-1.5 text-[12px] font-medium text-muted">
            {request.error ? tr('O que você estava fazendo? (opcional)', 'What were you doing? (optional)') : tr('O que aconteceu?', 'What happened?')}
          </span>
          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={tr(
              'Ex.: adicionei outra conta e a conversa numa pasta do WSL pede login no primeiro prompt.',
              'E.g.: I added another account and the chat in a WSL folder asks me to log in on the first prompt.'
            )}
            className={`${INPUT} w-full resize-y text-[13px]`}
          />
        </label>
        <p className="text-[12px] leading-relaxed text-faint">
          {tr(
            'O Claude só lê as configurações do Argus e do Claude Code nesta máquina: não muda nada e não abre seus arquivos de login. Leva alguns minutos e usa um pouco do limite da sua conta. Tokens e emails saem do relatório.',
            'Claude only reads Argus and Claude Code settings on this machine: it changes nothing and doesn’t open your login files. It takes a few minutes and uses a bit of your account’s limit. Tokens and emails are removed from the report.'
          )}
        </p>
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button onClick={onClose}>{tr('Cancelar', 'Cancel')}</Button>
        <Button variant="primary" disabled={!ready} onClick={() => window.api.report.start({ ...request, description })}>
          {tr('Investigar', 'Investigate')}
        </Button>
      </footer>
    </>
  )
}

function useElapsed(startedAt: number): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const STEPS_SHOWN = 8

function Running({ state }: { state: Extract<ReportState, { status: 'running' }> }) {
  const elapsed = useElapsed(state.startedAt)
  const steps = state.steps.slice(-STEPS_SHOWN)
  return (
    <>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-2 text-[13px] text-text">
          <Loader2 size={14} className="animate-spin text-muted" />
          {tr('Investigando…', 'Investigating…')}
          <span className="font-mono text-[12px] text-faint">{elapsed}</span>
        </div>
        <ul className="flex flex-col gap-1">
          {steps.map((step, i) => (
            <li key={state.steps.length - steps.length + i} className={`truncate text-[12px] ${i === steps.length - 1 ? 'text-muted' : 'text-faint'}`}>
              {step}
            </li>
          ))}
        </ul>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="text-[12px] text-faint">{tr('Pode fechar: a investigação continua.', 'You can close this: the investigation keeps going.')}</span>
        <Button onClick={() => window.api.report.stop()}>{tr('Parar', 'Stop')}</Button>
      </footer>
    </>
  )
}

function Done({ state, onClose }: { state: Extract<ReportState, { status: 'done' }>; onClose: () => void }) {
  const { copied, copy } = useCopied()
  return (
    <>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 py-4">
        <p className="text-[13px] text-text">
          {tr('Relatório pronto. Copie e mande para o desenvolvedor do Argus.', 'Report ready. Copy it and send it to the Argus developer.')}
        </p>
        {!state.analyzed && state.note && (
          <p className="rounded-md border border-ask/40 bg-ask/10 px-3 py-2 text-[12px] leading-relaxed text-text">
            {tr(`Sem a análise do Claude: ${state.note} O relatório vai com os dados que o app juntou.`, `Without Claude’s analysis: ${state.note} The report has the data the app collected.`)}
          </p>
        )}
        <pre className="min-h-0 flex-1 overflow-auto rounded-md border border-line bg-bg px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted select-text">
          {state.text}
        </pre>
      </div>
      <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={() => window.api.report.reset()}>
          {tr('Nova investigação', 'New investigation')}
        </Button>
        <div className="flex gap-2">
          <Button onClick={onClose}>{tr('Fechar', 'Close')}</Button>
          <Button variant="primary" onClick={() => void copy(state.text)}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? tr('Copiado', 'Copied') : tr('Copiar relatório', 'Copy report')}
          </Button>
        </div>
      </footer>
    </>
  )
}
