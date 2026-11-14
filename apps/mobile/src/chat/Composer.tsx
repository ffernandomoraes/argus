import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, FileText, GitBranch, Mic, Plus, Square, X } from 'lucide-react';
import type { ChatSettings } from '@argus/shared/chat';
import type { ClaudeInfo } from '@argus/shared/models';
import { tr } from '../i18n';
import { isImage } from '../lib/images';
import { canReadClipboard, filesFrom, readClipboard } from './clipboard';
import { ComposerOptions, ContextRing, modelSummary, type OptionsSheet } from './ComposerBar';
import { SuggestionChip } from './SuggestionChip';
import { useDictation } from './useDictation';
import { useKeyboard } from './useKeyboard';
import type { COMMANDS } from './options';

// A caixa cresce até 3 linhas (14px de fonte, ~19,3px por linha, mais 9px em cima e embaixo);
// passando disso, rola dentro.
const MAX_INPUT_HEIGHT = 76;

// A caixa de escrever, flutuando embaixo como uma pílula: o + (fotos e arquivos, colar, modelo, modo,
// comandos e contexto, ver ComposerBar.tsx), o texto (o microfone do teclado do celular já dita),
// o ditado próprio onde o navegador tem reconhecimento de voz, e enviar ou parar.

export type Draft = { text: string; files: File[] };

// Miniatura do anexo; o endereço temporário é liberado ao sair.
function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <img src={url} alt="" className="size-14 rounded-xl object-cover" /> : <div className="size-14 rounded-xl bg-code" />;
}

export function Composer({
  busy,
  onSend,
  onStop,
  disabled,
  settings,
  info,
  agentChat,
  contextPercent,
  branch,
  suggestion,
  working,
  onSettingsChange,
  onCommand,
  onHeight,
}: {
  busy: boolean
  onSend: (d: Draft) => Promise<void>
  onStop: () => void
  disabled?: boolean
  settings: ChatSettings
  info: ClaudeInfo | null
  agentChat: boolean
  // Quanto da janela de contexto a conversa já usou; nulo na conversa que ainda não começou.
  contextPercent: number | null
  // Branch do git da pasta (sem git, nada).
  branch?: string | null
  // Próxima mensagem prevista pelo Claude Code, ao fim do pedido.
  suggestion?: string
  // O que o agente está fazendo agora (WorkingLine), em cima da caixa.
  working?: ReactNode
  onSettingsChange: (patch: Partial<ChatSettings>) => void
  onCommand: (name: (typeof COMMANDS)[number]['name']) => void
  // Altura da parte sólida da caixa (sem o degradê de cima): a conversa termina logo acima dela.
  onHeight?: (height: number) => void
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<OptionsSheet>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  // O texto que já estava na caixa quando o ditado começou; a fala entra depois dele.
  const before = useRef('');
  const dictation = useDictation(
    () => {
      before.current = text;
      setError(null);
    },
    (spoken) => setText(before.current && !/\s$/.test(before.current) ? `${before.current} ${spoken}` : before.current + spoken),
    setError,
  );

  const addFiles = (list: File[]) => {
    if (list.length) setFiles((prev) => [...prev, ...list]);
  };
  // "Colar" do menu +: no iPhone, a caixa de texto não oferece colar quando o que foi copiado é só
  // uma imagem; a leitura pede a confirmação do próprio sistema.
  const pasteFromClipboard = () => {
    readClipboard().then(
      (got) => {
        if (got.files.length) addFiles(got.files);
        else if (got.text) setText((prev) => (prev && !/\s$/.test(prev) ? `${prev} ${got.text}` : prev + got.text));
        else setError(tr('Não há imagem, arquivo ou texto copiado.', 'Nothing copied: no image, file or text.'));
      },
      () => setError(tr('Não deu para ler o que foi copiado. Permita colar quando o celular perguntar.', 'Couldn’t read the clipboard. Allow pasting when the phone asks.')),
    );
  };

  const dictating = dictation?.on ?? false;
  const keyboardOpen = useKeyboard(area);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
    // Ditando, o texto novo entra no fim: a caixa desce junto, em vez de parar nas 3 primeiras linhas.
    if (dictating) el.scrollTop = el.scrollHeight;
  }, [text, dictating]);

  const canSend = (text.trim() || files.length > 0) && !sending && !disabled;
  const send = () => {
    if (!canSend) return;
    dictation?.stop(false);
    // A caixa limpa na hora (a mensagem já aparece na conversa); se o envio falhar, o rascunho volta.
    const draft = { text: text.trim(), files };
    setText('');
    setFiles([]);
    void submit(draft);
  };

  const submit = async (draft: Draft) => {
    setSending(true);
    setError(null);
    try {
      await onSend(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setText((t) => t || draft.text);
      setFiles((f) => (f.length ? f : draft.files));
    } finally {
      setSending(false);
    }
  };

  // A caixa muda de altura (sugestão, linha do que o agente faz, texto de várias linhas): a conversa
  // acompanha.
  const box = useRef<HTMLDivElement>(null);
  const heightRef = useRef(onHeight);
  heightRef.current = onHeight;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => heightRef.current?.(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const round = 'flex size-10 shrink-0 items-center justify-center rounded-full active:opacity-60';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      {/* O conteúdo some suave atrás da pílula, em vez de cortar seco. */}
      <div className="h-6 bg-gradient-to-b from-transparent to-bg" />
      <div ref={box} className={`px-safe bg-bg ${keyboardOpen ? 'pb-2' : 'pb-[max(12px,env(safe-area-inset-bottom))]'}`}>
        {error && <p className="pointer-events-auto px-2 pb-1.5 text-[12px] text-red">{error}</p>}
        {working}
        {/* Sugestão só com a caixa vazia e o agente parado (como no Argus). */}
        {suggestion && !busy && !sending && !disabled && !text && !files.length && (
          <SuggestionChip text={suggestion} onSend={() => void submit({ text: suggestion, files: [] })} />
        )}
        <div className="pointer-events-auto rounded-[28px] border border-line bg-card p-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)]">
          {files.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-1.5 pt-1.5 pb-2">
              {files.map((f, i) => (
                <div key={`${f.name}:${i}`} className="relative shrink-0">
                  {isImage(f) ? (
                    <Thumb file={f} />
                  ) : (
                    <div className="flex size-14 flex-col items-center justify-center gap-1 rounded-xl bg-code p-1 text-[11px] text-muted">
                      <FileText size={18} />
                      <span className="w-full truncate text-center">{f.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={tr('Remover', 'Remove')}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-text text-bg"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <button type="button" aria-label={tr('Opções e anexos', 'Options and attachments')} onClick={() => setSheet('menu')} className={`${round} bg-code text-text`}>
              <Plus size={22} />
            </button>
            <textarea
              ref={area}
              value={text}
              rows={1}
              onChange={(e) => setText(e.target.value)}
              // Imagem ou arquivo colado vira anexo; o texto colado entra como sempre.
              onPaste={(e) => addFiles(filesFrom(e.clipboardData))}
              placeholder={busy ? tr('Mandar mais um pedido…', 'Send another request…') : tr('Escreva um pedido…', 'Write a request…')}
              className="max-h-[76px] min-w-0 flex-1 resize-none bg-transparent px-1 py-[9px] text-[14px] leading-snug outline-none placeholder:text-faint"
            />
            {dictation && (
              <button
                type="button"
                aria-label={tr('Ditar', 'Dictate')}
                onClick={dictation.toggle}
                className={`${round} ${dictation.on ? 'bg-red text-white' : 'bg-code text-muted'}`}
              >
                <Mic size={20} />
              </button>
            )}
            {busy && !canSend ? (
              <button type="button" aria-label={tr('Parar', 'Stop')} onClick={onStop} className={`${round} bg-text text-bg`}>
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button type="button" aria-label={tr('Enviar', 'Send')} disabled={!canSend} onClick={send} className={`${round} bg-text text-bg disabled:opacity-25`}>
                <ArrowUp size={20} strokeWidth={2.6} />
              </button>
            )}
          </div>
        </div>
        {/* Embaixo da caixa, discreto: o contexto usado à esquerda; à direita, a branch e o modelo
            (tocar abre a escolha do modelo). */}
        <div className="pointer-events-auto mt-1.5 flex items-center gap-2 px-2 text-[11px] text-faint tabular-nums">
          {contextPercent !== null && (
            <span className="flex items-center gap-1" aria-label={tr(`Contexto usado: ${contextPercent}%`, `Context used: ${contextPercent}%`)}>
              <ContextRing percent={contextPercent} size={12} />
              {contextPercent}%
            </span>
          )}
          <span className="ml-auto flex min-w-0 items-center gap-2">
            {branch && (
              <span className="flex max-w-[45vw] min-w-0 items-center gap-1" aria-label={tr(`Branch ${branch}`, `Branch ${branch}`)}>
                <GitBranch size={12} className="shrink-0" />
                <span className="truncate">{branch}</span>
              </span>
            )}
            {branch && <span aria-hidden="true">-</span>}
            <button type="button" onClick={() => setSheet('model')} className="min-w-0 truncate active:opacity-60">
              {modelSummary(settings, info)}
            </button>
          </span>
        </div>
      </div>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const list = [...(e.target.files ?? [])];
          if (list.length) setFiles((prev) => [...prev, ...list]);
          e.target.value = '';
        }}
      />
      <ComposerOptions
        open={sheet}
        onOpen={setSheet}
        onAttach={() => picker.current?.click()}
        onPaste={canReadClipboard ? pasteFromClipboard : undefined}
        settings={settings}
        info={info}
        agentChat={agentChat}
        onChange={onSettingsChange}
        onCommand={onCommand}
      />
    </div>
  );
}
