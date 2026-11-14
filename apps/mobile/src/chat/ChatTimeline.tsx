import { AlertCircle } from 'lucide-react';
import type { ChatState, PermissionAnswer, QueuedMessage } from '@argus/shared/chat';
import type { Message } from '@argus/shared/history';
import { MarkdownText, MessageView, UserBubble, isStep } from './MessageView';
import { PermissionCard } from './PermissionCard';
import { Step } from './Step';
import type { TurnFooter } from './turnFooters';

// Mensagem enviada daqui que ainda não está no histórico.
export type Pending = { id: number; text: string; images: number; imageUrls?: string[]; files: string[]; at: number };

// A conversa na tela: o histórico, como a linha do tempo do Argus (cada passo do agente com bolinha
// e fio até o próximo), as mensagens a caminho, a resposta sendo escrita, os pedidos de permissão e o
// que o agente faz agora.
export function ChatTimeline({
  messages,
  cwd,
  sessionId,
  footers,
  running,
  pending,
  queued,
  state,
  onAnswer,
}: {
  messages: Message[]
  cwd: string
  sessionId?: string
  footers: Map<string, TurnFooter>
  running: boolean
  pending: Pending[]
  // Mensagens na fila do Argus que ainda não estão no histórico.
  queued: QueuedMessage[]
  state: ChatState | null
  onAnswer: (requestId: string, answer: PermissionAnswer) => void
}) {
  const partial = state?.partial && running ? state.partial : '';
  // Depois do histórico, a resposta sendo escrita (o que o agente faz agora fica em cima da caixa
  // de escrever, ver WorkingLine).
  const liveStep = !!partial && !pending.length && !queued.length;

  return (
    <div className="pt-2">
      {messages.map((m, i) => {
        const next = messages[i + 1];
        // O fio desce até o próximo passo: o seguinte no histórico, ou o que está acontecendo agora.
        const connect = isStep(m) && (next ? isStep(next) : liveStep);
        // Ação sem resultado no fim, com o agente trabalhando: é a que está rodando.
        const inProgress = running && !next && m.role === 'tool' && !m.result && !m.diff;
        return <MessageView key={m.id} m={m} cwd={cwd} sessionId={sessionId} footer={footers.get(m.id)} connect={connect} inProgress={inProgress} />;
      })}
      {pending.map((p) => (
        <UserBubble key={p.id} text={p.text} images={p.images || undefined} localImages={p.imageUrls} files={p.files} pending />
      ))}
      {queued.map((q) => (
        <UserBubble key={q.id} text={q.text} pending />
      ))}
      {partial && (
        <Step dot="bg-running animate-pulse-dot" connect={false}>
          <div className="py-1">
            <MarkdownText text={partial} />
          </div>
        </Step>
      )}
      {state?.permissions.map((p) => (
        <PermissionCard key={p.id} request={p} onAnswer={(a) => onAnswer(p.id, a)} />
      ))}
      {state?.error && !running && (
        <p className="my-2 flex items-start gap-1.5 rounded-xl bg-red/10 p-3 text-[14px] text-red">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
    </div>
  );
}
