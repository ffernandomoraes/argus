import { mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { conversationsUsage, stripMediaLine, trimConversations } from './transcripts'

// Os prints dentro das conversas: saem as imagens e os anexos em base64; o resto da linha (e da
// conversa) fica igual, para a conversa continuar abrindo e dar para retomar. Os formatos seguem os
// de conversas de verdade do Claude Code (2026-10-30).

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 30)
const png = { type: 'base64', media_type: 'image/png', data: 'iVBOR'.repeat(2000) }

const userWithImage = {
  type: 'user',
  uuid: 'u1',
  message: { role: 'user', content: [{ type: 'image', source: png }, { type: 'text', text: 'olha esse print' }] }
}
const toolResultWithImage = {
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'image', source: png }] }] },
  toolUseResult: { type: 'image', file: { base64: png.data, type: 'image/png', originalSize: 49537 } }
}
const pdf = { type: 'user', message: { role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBER' } }] } }

describe('stripMediaLine', () => {
  it('troca a imagem pelo texto e mantém o resto da mensagem', () => {
    const out = JSON.parse(stripMediaLine(JSON.stringify(userWithImage))!)
    expect(out.uuid).toBe('u1')
    expect(out.message.content).toEqual([
      { type: 'text', text: '[imagem removida]' },
      { type: 'text', text: 'olha esse print' }
    ])
  })

  it('também a imagem dentro do resultado de uma ferramenta, e o resultado da leitura dela sai', () => {
    const out = JSON.parse(stripMediaLine(JSON.stringify(toolResultWithImage))!)
    expect(out.message.content[0].content).toEqual([{ type: 'text', text: '[imagem removida]' }])
    expect(out.toolUseResult).toBeUndefined()
    expect(out.message.content[0].tool_use_id).toBe('t1')
  })

  it('anexo (PDF) vira "[arquivo removido]"', () => {
    expect(JSON.parse(stripMediaLine(JSON.stringify(pdf))!).message.content).toEqual([{ type: 'text', text: '[arquivo removido]' }])
  })

  it('linha sem imagem, ou que não é JSON, fica como está', () => {
    expect(stripMediaLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'oi' }] } }))).toBeNull()
    expect(stripMediaLine('{"base64": quebrado')).toBeNull()
  })
})

function conversation(root: string, id: string, ageDays: number, lines: unknown[]): string {
  const dir = join(root, '-Users-ana-proj')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${id}.jsonl`)
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', { mode: 0o600 })
  const at = new Date(NOW - ageDays * DAY)
  utimesSync(file, at, at)
  return file
}

describe('trimConversations', () => {
  it('tira os prints só das paradas há mais que o prazo, sem mudar a data nem a permissão', async () => {
    const root = mkdtempSync(join(tmpdir(), 'projects-'))
    const text = { type: 'assistant', message: { content: [{ type: 'text', text: 'resposta' }] } }
    const old = conversation(root, 'antiga', 90, [userWithImage, text])
    const recent = conversation(root, 'recente', 10, [userWithImage])
    const before = statSync(old)
    const result = await trimConversations(60, new Set(), NOW, root)
    expect(result.trimmed).toBe(1)
    expect(result.freedBytes).toBeGreaterThan(9000)
    const after = statSync(old)
    expect(after.mtimeMs).toBe(before.mtimeMs)
    // O Windows não tem essa permissão (só "somente leitura"): lá o modo vem sempre 0o666.
    if (process.platform !== 'win32') expect(after.mode & 0o777).toBe(0o600)
    const lines = readFileSync(old, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(lines[0].message.content[0]).toEqual({ type: 'text', text: '[imagem removida]' })
    expect(lines[1]).toEqual(text)
    expect(readFileSync(recent, 'utf8')).toContain('iVBOR')
  })

  // O readline cortava a linha nesses caracteres, que o JSON aceita dentro de texto: a conversa
  // saía com linhas partidas.
  it('linha com U+2028, U+2029 ou \\r dentro do texto continua inteira e igual', async () => {
    const root = mkdtempSync(join(tmpdir(), 'projects-'))
    const odd = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'a\u2028b\u2029c' }] } })
    const file = conversation(root, 'antiga', 90, [userWithImage])
    writeFileSync(file, `${readFileSync(file, 'utf8')}${odd}\n`)
    const at = new Date(NOW - 90 * DAY)
    utimesSync(file, at, at)
    await trimConversations(60, new Set(), NOW, root)
    const lines = readFileSync(file, 'utf8').split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe(odd)
    expect(lines[2]).toBe('')
  })

  it('a conversa rodando (e os subagentes dela) não é tocada', async () => {
    const root = mkdtempSync(join(tmpdir(), 'projects-'))
    const file = conversation(root, 'viva', 90, [userWithImage])
    const sub = join(root, '-Users-ana-proj', 'viva', 'subagents')
    mkdirSync(sub, { recursive: true })
    writeFileSync(join(sub, 'agent-1.jsonl'), JSON.stringify(userWithImage) + '\n')
    const at = new Date(NOW - 90 * DAY)
    utimesSync(join(sub, 'agent-1.jsonl'), at, at)
    expect((await trimConversations(60, new Set(['viva']), NOW, root)).trimmed).toBe(0)
    expect(readFileSync(file, 'utf8')).toContain('iVBOR')
    // Contam as conversas, não os arquivos dos subagentes.
    expect((await conversationsUsage(root)).count).toBe(1)
  })
})
