import { createContext, memo, useContext, useMemo, useState, type ReactNode } from 'react';
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { filesInBlock, withoutLegacyFiles } from '@argus/shared/attachedFiles';
import type { DiffHunk, Message } from '@argus/shared/history';
import { imageType, localImagePath } from '@argus/shared/imageFiles';
import { tr } from '../i18n';
import { UserImages } from './UserImages';
import { ImageLink, ImageStatus, SessionImageContext, useSessionImage } from './SessionImage';
import { baseName, formatDuration, formatTokens, messageTime } from '../ui/format';
import { Step } from './Step';
import type { TurnFooter } from './turnFooters';

// Uma mensagem do histórico, do jeito compacto do celular: as suas em balão, as respostas em texto
// formatado, e cada ferramenta numa linha que abre ao tocar.

const FILES_BLOCK = /\n*<argus-files(?: sizes="[\d,]*")?>\n[\s\S]*?\n<\/argus-files>\s*$/;

// Dentro de um link: a imagem dele não vira outro botão (botão dentro de <a>).
const InsideLink = createContext(false);

// Caminhos de imagem no computador ("C:\...", file://) passam; o resto segue a limpeza padrão.
const urlTransform = (url: string) => (localImagePath(url) ? url : defaultUrlTransform(url));

const MARKDOWN: Components = {
  a: ({ href = '', children }) => {
    const file = localImagePath(href);
    if (file) return <ImageLink file={file}>{children}</ImageLink>;
    return (
      <InsideLink.Provider value={true}>
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      </InsideLink.Provider>
    );
  },
  img: ({ src, alt }) => <MarkdownImage src={typeof src === 'string' ? src : ''} alt={alt} />,
};

// Imagem da web não carrega (a página só fala com a ponte); a do computador, citada na conversa,
// vira um link que abre o preview.
function MarkdownImage({ src, alt }: { src: string; alt?: string }) {
  const inLink = useContext(InsideLink);
  const file = localImagePath(src);
  const label: ReactNode = `[${alt || tr('imagem', 'image')}]`;
  return file && !inLink ? <ImageLink file={file}>{label}</ImageLink> : <span className="text-muted">{label}</span>;
}

export const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  return (
    <div className="prose-chat text-[15px]">
      <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN} urlTransform={urlTransform}>
        {text}
      </Markdown>
    </div>
  );
});

function DiffLines({ diff }: { diff: DiffHunk[] }) {
  return (
    <pre className="mt-1 overflow-x-auto rounded-lg bg-code p-2 font-mono text-[11px] leading-snug">
      {diff.flatMap((h, i) => [
        i > 0 ? <div key={`s${i}`} className="text-faint">⋯</div> : null,
        ...h.lines.slice(0, 200).map((l, j) => (
          <div key={`${i}:${j}`} className={l.startsWith('+') ? 'text-green' : l.startsWith('-') ? 'text-red' : 'text-muted'}>
            {l || ' '}
          </div>
        )),
      ])}
    </pre>
  );
}

function ToolRow({ m }: { m: Extract<Message, { role: 'tool' }> }) {
  const [open, setOpen] = useState(false);
  // Print que o Claude leu: tocar na linha abre a imagem, como no Argus; a seta abre o detalhe.
  const image = useSessionImage(m.name === 'Read' && m.detail && imageType(m.detail) ? m.detail : null);
  const result = m.result.length > 4000 ? `${m.result.slice(0, 4000)}\n…` : m.result;
  const chevron = open ? <ChevronDown size={16} className="mt-0.5 shrink-0" /> : <ChevronRight size={16} className="mt-0.5 shrink-0" />;
  return (
    <div className="text-[14px] leading-[20px]">
      {/* Fechada, uma linha só, cortada com "…", como no desktop; aberta, a linha inteira e o detalhe.
          Sem ícone: a bolinha do passo já marca (vermelha e o nome em vermelho quando deu erro). */}
      <div className="flex w-full items-start gap-1.5 text-muted">
        <button
          type="button"
          onClick={() => (image.canOpen ? image.open() : setOpen(!open))}
          className="flex min-w-0 flex-1 items-start gap-1.5 py-1 text-left active:opacity-60"
        >
          <span className={`min-w-0 flex-1 ${open ? '' : 'truncate'}`}>
            <span className={`font-medium ${m.error ? 'text-red' : 'text-text'}`}>{m.agent ? `${m.label}: ${m.agent}` : m.label}</span>
            {m.input && (
              <span className="text-muted">
                {' - '}
                <span className={image.canOpen ? 'underline decoration-faint underline-offset-2' : undefined}>{m.input}</span>
              </span>
            )}
            <ImageStatus state={image.state} />
          </span>
          {!image.canOpen && chevron}
        </button>
        {image.canOpen && (
          <button type="button" onClick={() => setOpen(!open)} aria-label={tr('Detalhes', 'Details')} className="-mr-1 px-1 py-1 active:opacity-60">
            {chevron}
          </button>
        )}
      </div>
      {image.preview}
      {open && (
        <div className="mb-2 ml-5">
          {m.detail && <pre className="overflow-x-auto rounded-lg bg-code p-2 font-mono text-[11px] whitespace-pre-wrap">{m.detail}</pre>}
          {m.diff?.length ? <DiffLines diff={m.diff} /> : null}
          {m.document ? (
            <div className="mt-1 rounded-lg bg-code p-2">
              <MarkdownText text={m.document} />
            </div>
          ) : (
            result && <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-code p-2 font-mono text-[11px] whitespace-pre-wrap">{result}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// Raciocínio, no estilo da linha de ferramenta (ToolRow): fechado, uma linha só com "Pensou por 4s" e
// o começo do raciocínio cortado com "…"; aberto, o texto inteiro. Sem ícone, como no Argus.
function Thinking({ m }: { m: Extract<Message, { role: 'thinking' }> }) {
  const [open, setOpen] = useState(false);
  const label = m.seconds ? tr(`Pensou por ${m.seconds}s`, `Thought for ${m.seconds}s`) : tr('Pensou', 'Thought');
  const preview = m.text.replace(/\s+/g, ' ').trim();
  return (
    <div className="text-[14px] leading-[20px]">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-1.5 py-1 text-left text-muted active:opacity-60">
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-text">{label}</span>
          {preview && <span>{` - ${preview}`}</span>}
        </span>
        {open ? <ChevronDown size={16} className="mt-0.5 shrink-0" /> : <ChevronRight size={16} className="mt-0.5 shrink-0" />}
      </button>
      {open && <p className="mb-2 rounded-lg bg-code p-2 text-[14px] whitespace-pre-wrap text-muted">{m.text}</p>}
    </div>
  );
}

// Hora embaixo da mensagem, pequena, do lado dela.
function Time({ at, right }: { at?: string; right?: boolean }) {
  const text = messageTime(at);
  return text ? <div className={`mt-0.5 text-[11px] text-faint tabular-nums ${right ? 'pr-1 text-right' : ''}`}>{text}</div> : null;
}

export function UserBubble({
  text,
  pending,
  images,
  files,
  imageRef,
  localImages,
  at,
}: {
  text: string
  pending?: boolean
  images?: number
  files?: string[]
  imageRef?: { cwd: string; sessionId: string; messageId: string }
  // Mensagem a caminho: as imagens do próprio envio, para as miniaturas aparecerem na hora.
  localImages?: string[]
  at?: string
}) {
  // data-prompt: o pedido preso no topo (PinnedPrompt) acha os balões por aqui.
  return (
    <div className="flex flex-col items-end py-1" data-prompt={text} data-images={images || undefined}>
      <div className={`max-w-[85%] rounded-[18px] bg-bubble px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap text-white ${pending ? 'opacity-60' : ''}`} style={{ overflowWrap: 'anywhere' }}>
        {/* Como no Argus: imagens (miniaturas e "1 imagem enviada") em cima, depois anexos e texto. */}
        {!!images && <UserImages count={images} imageRef={imageRef} local={localImages} />}
        {files?.map((f) => (
          <span key={f} className="mb-1 flex items-center gap-1 text-[12px] text-white/85">
            <FileText size={14} /> {baseName(f)}
          </span>
        ))}
        {text}
      </div>
      {pending ? <div className="mt-0.5 pr-1 text-[11px] text-faint">{tr('Enviando…', 'Sending…')}</div> : <Time at={at} right />}
    </div>
  );
}

// Passos do agente (resposta, ação, raciocínio, saída) ganham bolinha e fio; as suas mensagens e os
// avisos no meio da conversa, não.
export const isStep = (m: Message) => m.role !== 'user' && m.role !== 'event';

function dotOf(m: Message, inProgress: boolean): string {
  if (m.role === 'tool') return m.error ? 'bg-red' : inProgress ? 'bg-running animate-pulse-dot' : 'bg-green';
  return m.role === 'assistant' ? 'bg-faint' : 'bg-line';
}

// footer: só no último texto de cada pedido, como no Argus: "14:32 - levou 1min 05s - 2,3 mil tokens".
// connect: o fio desce até o próximo passo; inProgress: a ação que está rodando agora.
export const MessageView = memo(function MessageView({
  m,
  cwd,
  sessionId,
  footer,
  connect = false,
  inProgress = false,
}: {
  m: Message
  cwd: string
  sessionId?: string
  footer?: TurnFooter
  connect?: boolean
  inProgress?: boolean
}) {
  const row = <MessageRow m={m} cwd={cwd} sessionId={sessionId} footer={footer} />;
  const content = isStep(m) ? (
    <Step dot={dotOf(m, inProgress)} connect={connect}>
      {row}
    </Step>
  ) : (
    row
  );
  return <SessionImageProvider cwd={cwd} sessionId={sessionId}>{content}</SessionImageProvider>;
});

// A conversa da mensagem, para as imagens que o Claude leu ou citou (ver SessionImage.tsx).
function SessionImageProvider({ cwd, sessionId, children }: { cwd: string; sessionId?: string; children: ReactNode }) {
  const value = useMemo(() => (sessionId ? { cwd, sessionId } : null), [cwd, sessionId]);
  return <SessionImageContext.Provider value={value}>{children}</SessionImageContext.Provider>;
}

function MessageRow({ m, cwd, sessionId, footer }: { m: Message; cwd: string; sessionId?: string; footer?: TurnFooter }) {
  switch (m.role) {
    case 'user': {
      const legacy = withoutLegacyFiles(m.text.replace(FILES_BLOCK, ''));
      const files = [...(m.files ?? filesInBlock(m.text)), ...legacy.files].map((f) => f.path);
      return (
        <UserBubble
          text={legacy.text.trim()}
          images={m.images}
          files={files}
          imageRef={sessionId && m.images ? { cwd, sessionId, messageId: m.id } : undefined}
          at={m.at}
        />
      );
    }
    case 'assistant':
      return (
        <div className="py-1">
          <MarkdownText text={m.text} />
          {footer && (
            <div className="mt-0.5 text-[11px] text-faint tabular-nums">
              {messageTime(footer.at)}
              {footer.duration !== undefined && tr(` - levou ${formatDuration(footer.duration)}`, ` - took ${formatDuration(footer.duration)}`)}
              {footer.tokens > 0 && ` - ${formatTokens(footer.tokens)}`}
            </div>
          )}
        </div>
      );
    case 'thinking':
      return <Thinking m={m} />;
    case 'tool':
      return <ToolRow m={m} />;
    case 'output':
      return <pre className="my-1 overflow-x-auto rounded-lg bg-code p-2 font-mono text-[11px] whitespace-pre-wrap">{m.text}</pre>;
    case 'event':
      return (
        <div className="my-2 flex items-center gap-2 text-[12px] text-faint">
          <span className="h-px flex-1 bg-line" />
          <span className="max-w-[80%] truncate">{m.text}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      );
  }
}
