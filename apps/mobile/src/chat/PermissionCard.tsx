import { useState } from 'react';
import { ShieldQuestion } from 'lucide-react';
import type { PermissionAnswer, PermissionRequest, Question } from '@argus/shared/chat';
import { tr } from '../i18n';
import { QuestionText } from './QuestionText';

// O Claude pedindo permissão (rodar um comando, editar um arquivo) ou fazendo perguntas com opções.

// Marcador da opção "Outra resposta", que abre o campo de texto livre.
const OTHER = '__other';

function Questions({ questions, onAnswer }: { questions: Question[]; onAnswer: (a: PermissionAnswer) => void }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const toggle = (q: Question, label: string) =>
    setPicked((prev) => {
      const cur = prev[q.question] ?? [];
      const next = q.multiSelect ? (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]) : [label];
      return { ...prev, [q.question]: next };
    });
  // Opções marcadas + o texto livre, se "Outra resposta" estiver marcada e preenchida.
  const answerOf = (q: Question) => {
    const cur = picked[q.question] ?? [];
    const typed = cur.includes(OTHER) ? other[q.question]?.trim() : '';
    return [...cur.filter((l) => l !== OTHER), ...(typed ? [typed] : [])].join(', ');
  };
  const complete = questions.every((q) => answerOf(q));
  return (
    <div className="mt-2 space-y-3">
      {questions.map((q) => (
        <div key={q.question}>
          <QuestionText text={q.question} className="text-[14px] font-semibold" />
          <div className="mt-1.5 flex flex-col gap-1.5">
            {[...q.options, { label: OTHER, description: '' }].map((o) => {
              const on = picked[q.question]?.includes(o.label);
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => toggle(q, o.label)}
                  className={`rounded-xl border px-3 py-2 text-left ${on ? 'border-accent bg-accent/10' : 'border-line'}`}
                >
                  <span className="block text-[14px] font-medium">{o.label === OTHER ? tr('Outra resposta', 'Other answer') : o.label}</span>
                  {o.description && <span className="block text-[12px] leading-snug text-muted">{o.description}</span>}
                </button>
              );
            })}
            {picked[q.question]?.includes(OTHER) && (
              // 16px: abaixo disso o iPhone dá zoom na página ao focar o campo.
              <textarea
                autoFocus
                rows={2}
                value={other[q.question] ?? ''}
                onChange={(e) => setOther((prev) => ({ ...prev, [q.question]: e.target.value }))}
                placeholder={tr('Escreva sua resposta', 'Type your answer')}
                className="resize-none rounded-xl border border-line bg-card px-3 py-2 text-[16px] leading-snug outline-none placeholder:text-faint focus:border-accent"
              />
            )}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!complete}
          onClick={() => onAnswer({ answers: Object.fromEntries(questions.map((q) => [q.question, answerOf(q)])) })}
          className="flex-1 rounded-xl bg-accent py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          {tr('Responder', 'Answer')}
        </button>
        <button type="button" onClick={() => onAnswer('deny')} className="rounded-xl bg-code px-4 py-2.5 text-[14px] font-semibold">
          {tr('Pular', 'Skip')}
        </button>
      </div>
    </div>
  );
}

export function PermissionCard({ request, onAnswer }: { request: PermissionRequest; onAnswer: (a: PermissionAnswer) => void }) {
  const [busy, setBusy] = useState(false);
  const answer = (a: PermissionAnswer) => {
    setBusy(true);
    onAnswer(a);
  };
  return (
    <div className={`my-2 rounded-2xl border border-orange/40 bg-card p-3 ${busy ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <ShieldQuestion size={20} className="mt-0.5 shrink-0 text-orange" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">{request.title ?? request.label}</p>
          {request.summary && request.summary !== request.title && <p className="text-[14px] leading-snug text-muted">{request.summary}</p>}
        </div>
      </div>
      {request.detail && <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-code p-2 font-mono text-[11px] whitespace-pre-wrap">{request.detail}</pre>}
      {request.diff?.length ? (
        <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-code p-2 font-mono text-[11px] leading-snug">
          {request.diff.flatMap((h, i) =>
            h.lines.slice(0, 120).map((l, j) => (
              <div key={`${i}:${j}`} className={l.startsWith('+') ? 'text-green' : l.startsWith('-') ? 'text-red' : 'text-muted'}>
                {l || ' '}
              </div>
            )),
          )}
        </pre>
      ) : null}
      {request.questions?.length ? (
        <Questions questions={request.questions} onAnswer={answer} />
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={() => answer('allow')} className="flex-1 rounded-xl bg-accent py-2.5 text-[14px] font-semibold text-white">
            {tr('Permitir', 'Allow')}
          </button>
          {request.canAlwaysAllow && (
            <button type="button" disabled={busy} onClick={() => answer('always')} className="flex-1 rounded-xl bg-code py-2.5 text-[14px] font-semibold">
              {tr('Sempre', 'Always')}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => answer('deny')} className="rounded-xl bg-code px-4 py-2.5 text-[14px] font-semibold text-red">
            {tr('Negar', 'Deny')}
          </button>
        </div>
      )}
    </div>
  );
}
