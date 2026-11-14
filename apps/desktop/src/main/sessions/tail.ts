import { arr, num, obj, parseLine, str, type Line } from '../transcripts/line';
import { readSlice } from '../transcripts/read';
import { userText } from './prompt';

// Título e uso de contexto são regravados ao longo da conversa: basta ler o fim.
export const TAIL_BYTES = 512 * 1024;

// Até onde voltar atrás da última resposta quando o fim não tem nenhuma. Prints e imagens coladas
// gravam linhas de centenas de KB a mais de 1 MB: a última resposta ficava antes dos 512 KB do
// fim, e o contexto aparecia zerado no Mac, no Windows e no celular até a próxima resposta.
const USAGE_SEARCH_BYTES = 32 * 1024 * 1024;

export type Usage = { tokens: number; model: string };

export type Tail = {
  // Da última linha de cada tipo; só vale texto não vazio (título vazio sumia com a conversa).
  customTitle?: string
  aiTitle?: string
  usage?: Usage
  // Hora da última resposta do Claude com texto (ferramentas e resultados não contam).
  repliedAt?: string
  // Primeira mensagem da pessoa no trecho: só procurada quando o começo do arquivo não tinha.
  firstPrompt?: string
};

// Tudo que entrou na última resposta = o que a conversa ocupa da janela agora.
function usageOf(l: Line): Usage | undefined {
  const message = l.type === 'assistant' && !l.isSidechain ? obj(l.message) : undefined;
  const usage = obj(message?.usage);
  const model = message?.model;
  // "<synthetic>": aviso do próprio Claude Code (erro, interrupção), sem uso real.
  if (!usage || typeof model !== 'string' || model === '<synthetic>') return undefined;
  const tokens =
    (num(usage.input_tokens) ?? 0) + (num(usage.cache_creation_input_tokens) ?? 0) + (num(usage.cache_read_input_tokens) ?? 0);
  return tokens === 0 ? undefined : { tokens, model };
}

// Resposta de verdade: texto do Claude na conversa principal, fora os avisos do próprio Claude Code.
function replyAt(l: Line): string | undefined {
  if (l.type !== 'assistant' || l.isSidechain) return undefined;
  const message = obj(l.message);
  if (message?.model === '<synthetic>') return undefined;
  const content = arr(message?.content);
  const hasText = content?.some((c) => obj(c)?.type === 'text' && typeof obj(c)?.text === 'string' && String(obj(c)?.text).trim());
  return hasText ? str(l.timestamp) : undefined;
}

// Tamanho da conversa depois de uma compactação.
function compactedTo(l: Line): number | undefined {
  return l.type === 'system' && l.subtype === 'compact_boundary' ? (num(obj(l.compactMetadata)?.postTokens) ?? 0) : undefined;
}

// A resposta de antes da compactação só serve para saber o modelo.
function usageAfter(l: Line, compacted: number | undefined): Usage | undefined {
  const usage = usageOf(l);
  return usage && compacted !== undefined ? { ...usage, tokens: compacted } : usage;
}

// Procura a última resposta antes de `end`, de trás para frente em pedaços de TAIL_BYTES.
// `carry` é o começo cortado da primeira linha já lida, que termina no pedaço anterior.
async function usageBefore(file: string, end: number, carry: string, compacted: number | undefined): Promise<Usage | undefined> {
  for (let stop = end; stop > 0 && end - stop < USAGE_SEARCH_BYTES; ) {
    const start = Math.max(0, stop - TAIL_BYTES);
    const lines = ((await readSlice(file, start, stop - start)) + carry).split('\n');
    // A primeira linha do pedaço pode estar cortada: vai inteira com o pedaço seguinte.
    carry = start > 0 ? (lines.shift() ?? '') : '';
    for (let i = lines.length - 1; i >= 0; i--) {
      const raw = lines[i];
      const wantUsage = raw.includes('"usage"');
      const wantCompact = compacted === undefined && raw.includes('"compact_boundary"');
      if (!wantUsage && !wantCompact) continue;
      const l = parseLine(raw);
      if (!l) continue;
      if (wantCompact) compacted = compactedTo(l) ?? compacted;
      const usage = wantUsage ? usageAfter(l, compacted) : undefined;
      if (usage) return usage;
    }
    stop = start;
  }
  return undefined;
}

const title = (x: unknown) => (typeof x === 'string' && x.trim() ? x : undefined);

export async function readTail(file: string, size: number, wantPrompt: boolean): Promise<Tail> {
  const text = await readSlice(file, Math.max(0, size - TAIL_BYTES), Math.min(size, TAIL_BYTES));
  const lines = text.split('\n');
  const tail: Tail = {};
  let custom = false;
  let ai = false;
  // Compactação depois da última resposta: a conversa ocupa o tamanho resumido, não o de antes.
  let compacted: number | undefined;
  // De trás para frente, montando só as linhas que podem ter o que falta (o texto é conferido
  // antes): parsear os 512 KB inteiros de cada conversa pesava com centenas delas.
  for (let i = lines.length - 1; i >= 0 && !(custom && ai && tail.usage && tail.repliedAt); i--) {
    const raw = lines[i];
    const wantCustom = !custom && raw.includes('"custom-title"');
    const wantAi = !ai && raw.includes('"ai-title"');
    const wantUsage = !tail.usage && raw.includes('"usage"');
    const wantCompact = !tail.usage && compacted === undefined && raw.includes('"compact_boundary"');
    const wantReply = !tail.repliedAt && raw.includes('"assistant"') && raw.includes('"text"');
    if (!wantCustom && !wantAi && !wantUsage && !wantCompact && !wantReply) continue;
    const l = parseLine(raw);
    if (!l) continue;
    if (wantCustom && l.type === 'custom-title') {
      custom = true;
      tail.customTitle = title(l.customTitle);
    }
    if (wantAi && l.type === 'ai-title') {
      ai = true;
      tail.aiTitle = title(l.aiTitle);
    }
    if (wantCompact) compacted = compactedTo(l) ?? compacted;
    if (wantUsage) tail.usage = usageAfter(l, compacted);
    if (wantReply) tail.repliedAt = replyAt(l);
  }
  const start = Math.max(0, size - TAIL_BYTES);
  if (!tail.usage && start > 0) tail.usage = await usageBefore(file, start, lines[0], compacted);
  if (wantPrompt) {
    for (const raw of lines) {
      if (!raw.includes('"user"')) continue;
      const l = parseLine(raw);
      const prompt = l && userText(l);
      if (prompt) {
        tail.firstPrompt = prompt;
        break;
      }
    }
  }
  return tail;
}
