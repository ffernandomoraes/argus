import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Message } from '../../shared/history'
import {
  conversationsIn,
  indexEntry,
  isAgentConversation,
  loadConversation,
  loadImages,
  saveConversation,
  saveImages,
  samePath,
  trashConversation,
  type StoredConversation
} from './store'

// A Lixeira do sistema não existe nos testes: o "mover para a Lixeira" só apaga o arquivo.
vi.mock('electron', async () => {
  const actual = await vi.importActual<typeof import('electron')>('electron')
  const { rmSync } = await import('node:fs')
  return { ...actual, shell: { trashItem: async (path: string) => rmSync(path) } }
})


// As conversas com Codex, Gemini e Cursor só existem nestes arquivos: se a gravação ou a leitura
// quebra, a pessoa perde o histórico.

const dir = () => join(homedir(), '.argus-dev', 'conversations')
let n = 0
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

function conversation(extra: Partial<StoredConversation> = {}): StoredConversation {
  return {
    version: 1,
    id: newId(),
    provider: 'codex',
    account: 'main',
    cwd: join(homedir(), 'proj'),
    title: 'Arrumar o login',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:05:00.000Z',
    contextPercent: 12,
    messages: [],
    ...extra
  }
}

const reply = (at: string): Message => ({ id: `r-${at}`, role: 'assistant', text: 'ok', at })

describe('gravar e ler uma conversa', () => {
  it('volta igual ao que foi gravado, com o id nativo para o agente retomar', () => {
    const c = conversation({ nativeId: 'thread-123', messages: [{ id: 'u1', role: 'user', text: 'oi', at: '2026-10-20T10:00:00.000Z' }, reply('2026-10-20T10:01:00.000Z')] })
    saveConversation(c)
    expect(loadConversation(c.id)).toEqual(c)
    expect(isAgentConversation(c.id)).toBe(true)
  })

  it('id que não é de conversa (caminho, texto qualquer) não lê arquivo nenhum', () => {
    // Um arquivo válido fora da pasta das conversas: o id com "../" não pode alcançá-lo.
    mkdirSync(dir(), { recursive: true })
    writeFileSync(join(homedir(), '.argus-dev', 'fora.json'), JSON.stringify(conversation()))
    expect(loadConversation('../fora')).toBeNull()
    expect(loadConversation('index.json')).toBeNull()
    expect(isAgentConversation('../x')).toBe(false)
  })

  it('arquivo de outra versão ou estragado não abre como conversa', () => {
    const id = newId()
    mkdirSync(dir(), { recursive: true })
    writeFileSync(join(dir(), `${id}.json`), JSON.stringify({ ...conversation({ id }), version: 2 }))
    expect(loadConversation(id)).toBeNull()
    writeFileSync(join(dir(), `${id}.json`), '{"version":1,')
    expect(loadConversation(id)).toBeNull()
  })
})

describe('lista de conversas da pasta', () => {
  // 2d84532: ordenar pela gravação embaralhava a lista a cada passo de uma conversa.
  it('só as da pasta, mais recente pela última resposta (não pela última gravação)', () => {
    const cwd = join(homedir(), 'lista')
    const old = conversation({ cwd, title: 'velha', updatedAt: '2026-10-21T09:00:00.000Z', messages: [reply('2026-10-19T08:00:00.000Z')] })
    const fresh = conversation({ cwd, title: 'nova', updatedAt: '2026-10-20T09:00:00.000Z', messages: [reply('2026-10-20T08:00:00.000Z')] })
    saveConversation(old)
    saveConversation(fresh)
    saveConversation(conversation({ cwd: join(homedir(), 'outra') }))
    expect(conversationsIn(cwd).map((c) => c.title)).toEqual(['nova', 'velha'])
  })

  it('a mesma pasta escrita com "~" ou barra no fim', () => {
    const c = conversation({ cwd: '~/til' })
    saveConversation(c)
    expect(conversationsIn(join(homedir(), 'til') + '/').map((e) => e.id)).toEqual([c.id])
    expect(samePath('~/til', join(homedir(), 'til'))).toBe(true)
  })

  it('conversa sem resposta ainda entra pela hora em que começou', () => {
    const c = conversation({ cwd: join(homedir(), 'sem-resposta'), createdAt: '2026-10-22T10:00:00.000Z' })
    saveConversation(c)
    expect(indexEntry(c.id)?.repliedAt).toBe('2026-10-22T10:00:00.000Z')
  })
})

describe('imagens e Lixeira', () => {
  it('as imagens de cada mensagem ficam à parte e voltam pela mensagem', () => {
    const c = conversation()
    saveImages(c.id, 'm1', ['data:image/png;base64,AAA'])
    saveImages(c.id, 'm2', ['data:image/png;base64,BBB'])
    expect(loadImages(c.id, 'm1')).toEqual(['data:image/png;base64,AAA'])
    expect(loadImages(c.id, 'm3')).toEqual([])
  })

  it('apagar tira o arquivo, as imagens e a conversa da lista', async () => {
    const c = conversation({ cwd: join(homedir(), 'lixo') })
    saveConversation(c)
    saveImages(c.id, 'm1', ['data:image/png;base64,AAA'])
    expect(await trashConversation(c.id)).toBeNull()
    expect(existsSync(join(dir(), `${c.id}.json`))).toBe(false)
    expect(existsSync(join(dir(), `${c.id}.images.json`))).toBe(false)
    expect(conversationsIn(c.cwd)).toEqual([])
  })

  it('conversa que não existe: erro, nada apagado', async () => {
    expect(await trashConversation(newId())).toBe('Conversa inválida.')
  })
})
