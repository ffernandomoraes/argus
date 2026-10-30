import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { conversationDays, ensureConversationDays, setConversationDays } from './retention'

// O prazo em que o Claude Code apaga as conversas inteiras (cleanupPeriodDays): o Argus lê e grava o
// mesmo valor, sem perder o resto das configurações da pessoa.

const fileIn = () => join(mkdtempSync(join(tmpdir(), 'settings-')), 'settings.json')
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'))

describe('prazo das conversas', () => {
  it('sem prazo no arquivo, a abertura põe o padrão do Argus e mantém as outras configurações', () => {
    const f = fileIn()
    writeFileSync(f, JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(ls)'] } }))
    expect(conversationDays(f)).toBeNull()
    ensureConversationDays(90, f)
    expect(read(f)).toEqual({ model: 'opus', permissions: { allow: ['Bash(ls)'] }, cleanupPeriodDays: 90 })
  })

  it('prazo que já estava no arquivo fica; sem o arquivo, cria', () => {
    const f = fileIn()
    writeFileSync(f, JSON.stringify({ cleanupPeriodDays: 45 }))
    ensureConversationDays(90, f)
    expect(conversationDays(f)).toBe(45)
    const g = fileIn()
    ensureConversationDays(90, g)
    expect(read(g)).toEqual({ cleanupPeriodDays: 90 })
  })

  it('a escolha na aba grava o novo; 0 (não guardar conversa) e arquivo estragado não são gravados', () => {
    const f = fileIn()
    writeFileSync(f, JSON.stringify({ cleanupPeriodDays: 90, model: 'opus' }))
    expect(setConversationDays(30, f)).toBe(true)
    expect(read(f)).toEqual({ cleanupPeriodDays: 30, model: 'opus' })
    expect(setConversationDays(0, f)).toBe(false)
    expect(conversationDays(f)).toBe(30)
    writeFileSync(f, '{ "model": ')
    expect(setConversationDays(60, f)).toBe(false)
    ensureConversationDays(90, f)
    expect(readFileSync(f, 'utf8')).toBe('{ "model": ')
  })
})

describe('withMediaCap', () => {
  it('prints com prazo maior que o das conversas ficam iguais a ele; menor fica como está', async () => {
    const { withMediaCap } = await import('../../shared/storage')
    expect(withMediaCap({ conversationDays: 30, mediaDays: 60, scratchDays: 7 }).mediaDays).toBe(30)
    expect(withMediaCap({ conversationDays: 90, mediaDays: 60, scratchDays: 7 }).mediaDays).toBe(60)
  })
})
