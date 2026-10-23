import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Linhas do .jsonl do Claude Code para os testes, no formato real (campos conferidos em transcrições
// da 2.1.30x em 2026-10-23). Sintéticas: nenhuma é cópia de conversa de alguém. Cada função devolve
// o objeto da linha; `extra` sobrescreve ou acrescenta campos.

type Extra = Record<string, unknown>

let counter = 0
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`
const T0 = Date.parse('2026-10-20T12:00:00.000Z')
const nextAt = () => new Date(T0 + counter * 1000).toISOString()

// Campos que toda linha da conversa traz.
function base(type: string, extra: Extra = {}): Extra {
  return {
    parentUuid: null,
    isSidechain: false,
    type,
    uuid: nextId(),
    timestamp: nextAt(),
    userType: 'external',
    entrypoint: 'sdk-ts',
    cwd: '/Users/ana/proj',
    sessionId: 'aaaaaaaa-0000-4000-8000-000000000000',
    version: '2.1.308',
    gitBranch: 'main',
    ...extra
  }
}

// Mensagem da pessoa: texto direto ou lista de partes (texto, imagem, resultado de ferramenta).
export function user(content: string | unknown[], extra: Extra = {}): Extra {
  return base('user', { message: { role: 'user', content }, ...extra })
}

export type AssistantOptions = {
  model?: string
  // Id da resposta da API: as partes da mesma resposta vêm em linhas separadas com o mesmo id.
  apiId?: string
  usage?: Extra
}

// Resposta do Claude com as partes dadas (ver text, thinking, toolUse).
export function assistant(content: unknown[], options: AssistantOptions = {}, extra: Extra = {}): Extra {
  const { model = 'claude-opus-5-5', apiId = `msg_${counter + 1}`, usage = { input_tokens: 10, output_tokens: 20 } } = options
  return base('assistant', {
    message: { model, id: apiId, type: 'message', role: 'assistant', content, stop_reason: 'end_turn', usage },
    requestId: `req_${counter + 1}`,
    ...extra
  })
}

export const text = (value: string) => ({ type: 'text', text: value })
export const thinking = (value: string) => ({ type: 'thinking', thinking: value, signature: 'sig' })
export const toolUse = (id: string, name: string, input: Extra = {}) => ({ type: 'tool_use', id, name, input })
export const toolResult = (toolUseId: string, content: unknown, isError = false) => ({
  type: 'tool_result',
  tool_use_id: toolUseId,
  content,
  is_error: isError
})
export const image = (data = 'aGVsbG8=', mediaType = 'image/png') => ({ type: 'image', source: { type: 'base64', media_type: mediaType, data } })

// Divisor que o Claude Code grava ao compactar a conversa.
export function compactBoundary(preTokens: number, postTokens: number, extra: Extra = {}): Extra {
  return base('system', {
    subtype: 'compact_boundary',
    content: 'Conversation compacted',
    isMeta: false,
    level: 'info',
    compactMetadata: { trigger: 'auto', preTokens, durationMs: 1000, postTokens, cumulativeDroppedTokens: 0 },
    ...extra
  })
}

// Mensagem enviada no meio de uma resposta: o anexo "queued_command" com o texto em prompt.
export function queued(prompt: unknown[], sourceUuid?: string, extra: Extra = {}): Extra {
  return base('attachment', {
    attachment: { type: 'queued_command', prompt, ...(sourceUuid && { source_uuid: sourceUuid }), commandMode: 'prompt', timestamp: nextAt() },
    ...extra
  })
}

export const aiTitle = (title: string, extra: Extra = {}) => ({ type: 'ai-title', aiTitle: title, sessionId: 'aaaaaaaa-0000-4000-8000-000000000000', ...extra })
export const customTitle = (title: string, extra: Extra = {}) => ({ type: 'custom-title', customTitle: title, sessionId: 'aaaaaaaa-0000-4000-8000-000000000000', ...extra })

// O arquivo .jsonl com as linhas, numa pasta nova dentro da pasta pessoal falsa. `raw`: linhas já em
// texto (para simular linha cortada ou lixo no meio).
export function writeTranscript(lines: (Extra | string)[], name = 'session.jsonl'): { file: string; size: number } {
  const dir = mkdtempSync(join(process.env.HOME ?? '', 'transcript-'))
  const file = join(dir, name)
  const body = lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n'
  writeFileSync(file, body)
  return { file, size: Buffer.byteLength(body) }
}
