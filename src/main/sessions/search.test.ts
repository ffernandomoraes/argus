import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assistant, text, toolResult, toolUse, user } from '../../../test/transcript'
import { projectDir } from '../transcripts/projectDir'
import { fold, searchSessions } from './search'

let n = 0
function projectWith(sessions: Record<string, object[]>): string {
  const path = join(process.env.HOME ?? '', `busca${++n}`)
  const dir = projectDir(path)
  mkdirSync(dir, { recursive: true })
  for (const [id, lines] of Object.entries(sessions)) {
    writeFileSync(join(dir, `${id}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  }
  return path
}

const ids = (hits: { id: string }[]) => hits.map((h) => h.id).sort()

describe('fold', () => {
  it('tira acento e maiúscula', () => {
    expect(fold('Configuração ÁREA')).toBe('configuracao area')
  })
})

describe('searchSessions', () => {
  it('acha pelo que a pessoa escreveu e pelo que o Claude respondeu, sem ligar para acento', async () => {
    const path = projectWith({
      pedido: [user('Arruma a configuração do login')],
      resposta: [user('oi'), assistant([text('Mudei a CONFIGURACAO do Vite')])],
      outra: [user('nada a ver')]
    })
    expect(ids(await searchSessions(path, 'configuracao'))).toEqual(['pedido', 'resposta'])
  })

  // Senão quase toda busca acharia tudo: saída de ferramenta, subagente e recados do sistema.
  it('ignora saída de ferramenta, subagente, mensagem interna e avisos "<...>"', async () => {
    const path = projectWith({
      ferramenta: [assistant([toolUse('t1', 'Bash', { command: 'cat x' })]), user([toolResult('t1', 'segredo no arquivo')])],
      subagente: [assistant([text('segredo do subagente')], {}, { isSidechain: true })],
      meta: [user('segredo meta', { isMeta: true })],
      aviso: [user('<system-reminder>segredo</system-reminder>')]
    })
    expect(await searchSessions(path, 'segredo')).toEqual([])
  })

  it('devolve um trecho em volta da primeira ocorrência', async () => {
    const before = 'a '.repeat(60)
    const path = projectWith({ longa: [user(`${before}aqui está o termo buscado e o resto da frase`)] })
    const [hit] = await searchSessions(path, 'termo')
    expect(hit.snippet.startsWith('…')).toBe(true)
    expect(hit.snippet).toContain('o termo buscado e o resto da frase')
  })

  it('termo com menos de duas letras não busca', async () => {
    const path = projectWith({ a: [user('x y z')] })
    expect(await searchSessions(path, ' x ')).toEqual([])
  })

  it('pasta sem conversas: nada, sem erro', async () => {
    expect(await searchSessions(join(process.env.HOME ?? '', 'vazia'), 'algo')).toEqual([])
  })
})
