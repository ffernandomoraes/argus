import { describe, expect, it } from 'vitest'
import type { Message } from '../../shared/history'
import { assistant, compactBoundary, image, queued, text, thinking, toolResult, toolUse, user } from '../../../test/transcript'
import { HistoryParser } from './parser'

type Line = Record<string, unknown>

const parse = (lines: Line[], keep?: number) => {
  const parser = new HistoryParser(keep)
  for (const l of lines) parser.feed(l)
  return parser
}

const messagesOf = (lines: Line[]) => parse(lines).messages()
const roles = (list: Message[]) => list.map((m) => m.role)
const texts = (list: Message[]) => list.map((m) => ('text' in m ? m.text : m.role))

describe('HistoryParser: mensagens da conversa', () => {
  it('monta pergunta e resposta na ordem, sem espaços nas pontas', () => {
    const list = messagesOf([user('  oi  '), assistant([text(' olá! ')])])
    expect(list).toMatchObject([
      { role: 'user', text: 'oi' },
      { role: 'assistant', text: 'olá!' }
    ])
  })

  it('deixa de fora subagente, linha meta e o resumo da compactação', () => {
    const list = messagesOf([
      user('pedido'),
      assistant([text('do subagente')], {}, { isSidechain: true }),
      user('aviso interno', { isMeta: true }),
      user('Resumo da conversa anterior...', { isCompactSummary: true }),
      assistant([text('resposta')])
    ])
    expect(texts(list)).toEqual(['pedido', 'resposta'])
  })

  it('avisos internos (<system-reminder>) não viram mensagem da pessoa', () => {
    const list = messagesOf([user([text('<system-reminder>x</system-reminder>'), text('o pedido de verdade')])])
    expect(texts(list)).toEqual(['o pedido de verdade'])
  })

  it('parte com formato estranho fica de fora e o resto da resposta aparece', () => {
    const list = messagesOf([assistant([null, { type: 'text', text: 42 }, text('ok')])])
    expect(texts(list)).toEqual(['ok'])
  })

  it('resposta cortada no meio aparece como aviso em português, não em inglês', () => {
    const list = messagesOf([assistant([text('No response requested.')], { model: '<synthetic>' })])
    expect(list[0]).toMatchObject({ role: 'assistant', text: 'A resposta anterior foi interrompida antes de terminar. Seguindo daqui.' })
  })

  it('raciocínio entra com quanto durou desde a linha anterior', () => {
    const question = user('pensa')
    const answer = assistant([thinking('hmm')])
    answer.timestamp = new Date(Date.parse(question.timestamp as string) + 7000).toISOString()
    const list = messagesOf([question, answer])
    expect(list[1]).toMatchObject({ role: 'thinking', text: 'hmm', seconds: 7 })
  })
})

describe('HistoryParser: ferramentas', () => {
  it('liga o resultado à chamada pelo id, mesmo chegando depois', () => {
    const list = messagesOf([
      assistant([toolUse('t1', 'Bash', { command: 'ls -la', description: 'Listar arquivos' })]),
      user([toolResult('t1', 'a.ts\nb.ts')])
    ])
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ role: 'tool', name: 'Bash', label: 'Comando', input: 'Listar arquivos', detail: 'ls -la', result: 'a.ts\nb.ts', error: false })
  })

  it('marca erro e não mostra diff de edição que falhou', () => {
    const patch = { structuredPatch: [{ oldStart: 1, newStart: 1, lines: ['-a', '+b'] }] }
    const list = messagesOf([
      assistant([toolUse('ok', 'Edit', { file_path: '/p/a.ts' }), toolUse('bad', 'Edit', { file_path: '/p/b.ts' })]),
      user([toolResult('ok', 'feito')], { toolUseResult: patch }),
      user([toolResult('bad', 'falhou', true)], { toolUseResult: patch })
    ])
    const [ok, bad] = list as Extract<Message, { role: 'tool' }>[]
    expect(ok.diff).toEqual([{ oldStart: 1, newStart: 1, lines: ['-a', '+b'] }])
    expect(bad.error).toBe(true)
    expect(bad.diff).toBeUndefined()
  })

  it('corta o resultado comprido, mas deixa o relatório do subagente bem maior', () => {
    const long = 'x'.repeat(30_000)
    const list = messagesOf([
      assistant([toolUse('b', 'Bash', { command: 'cat' }), toolUse('a', 'Agent', { subagent_type: 'Explore', prompt: 'procura' })]),
      user([toolResult('b', long), toolResult('a', long)])
    ]) as Extract<Message, { role: 'tool' }>[]
    expect(list[0].result.length).toBeLessThan(2100)
    expect(list[1].result.length).toBeGreaterThan(19_000)
    expect(list[1].result.length).toBeLessThan(20_100)
    expect(list[1].agent).toBe('Explore')
  })

  it('etapa delegada pelo orquestrador aparece como subagente com o agente e o modelo', () => {
    const list = messagesOf([assistant([toolUse('d', 'mcp__argus__delegate', { agent: 'codex', model: 'gpt-5.5', task: 'faz', title: 'Etapa' })])])
    expect(list[0]).toMatchObject({ role: 'tool', agent: 'Codex - gpt-5.5', label: 'Delegar', input: 'Etapa' })
  })
})

describe('HistoryParser: tokens', () => {
  // A mesma resposta da API vem em várias linhas (raciocínio, texto, ferramenta) com o mesmo id e o
  // mesmo uso: somar cada linha multiplicava os tokens.
  it('conta os tokens uma vez por resposta da API, na primeira parte que aparece', () => {
    const usage = { input_tokens: 1, output_tokens: 300 }
    const list = messagesOf([
      assistant([thinking('   ')], { apiId: 'msg_A', usage }),
      assistant([text('resposta')], { apiId: 'msg_A', usage }),
      assistant([toolUse('t', 'Read', { file_path: '/a' })], { apiId: 'msg_A', usage }),
      assistant([text('outra')], { apiId: 'msg_B', usage: { output_tokens: 50 } })
    ])
    expect(list.map((m) => ('tokens' in m ? m.tokens : undefined))).toEqual([300, undefined, 50])
  })
})

describe('HistoryParser: linhas repetidas', () => {
  // Bug corrigido em cee696c: ao retomar, o Claude Code às vezes grava a conversa de novo no mesmo
  // arquivo, e o histórico mostrava o mesmo trecho duas ou três vezes.
  it('a mesma linha (mesmo uuid) entra uma vez só', () => {
    const a = user('pergunta')
    const b = assistant([text('resposta')])
    const list = messagesOf([a, b, a, b, a, b])
    expect(texts(list)).toEqual(['pergunta', 'resposta'])
  })
})

describe('HistoryParser: mensagem enviada no meio da resposta', () => {
  it('aparece onde foi entregue ao Claude, marcada como enviada durante a resposta', () => {
    const list = messagesOf([user('começa'), assistant([toolUse('t', 'Bash', { command: 'ls' })]), queued([text('e também isso')], 'src-1')])
    expect(list[2]).toMatchObject({ role: 'user', text: 'e também isso', queued: true })
  })

  it('não repete quando a mesma mensagem volta como linha comum com o id do anexo', () => {
    const later = user('e também isso')
    const list = messagesOf([queued([text('e também isso')], later.uuid as string), later])
    expect(list).toHaveLength(1)
  })

  it('sessão sem source_uuid: não repete pelo texto, e só uma vez', () => {
    const list = messagesOf([queued([text('mesmo texto')]), user('mesmo texto'), user('mesmo texto')])
    expect(texts(list)).toEqual(['mesmo texto', 'mesmo texto'])
    expect(list.map((m) => m.role === 'user' && m.queued)).toEqual([true, undefined])
  })

  // Bug corrigido em 7a65f91: o print enviado no meio da resposta vai no prompt do anexo, e sumia.
  it('mensagem só com print aparece, com a contagem de imagens', () => {
    const list = messagesOf([queued([image(), image()])])
    expect(list[0]).toMatchObject({ role: 'user', text: '', queued: true, images: 2 })
  })
})

describe('HistoryParser: prints e anexos', () => {
  it('conta as imagens da mensagem e mostra mensagem só com print', () => {
    const list = messagesOf([user([image()]), user([text('olha'), image(), image()])])
    expect(list).toMatchObject([
      { role: 'user', text: '', images: 1 },
      { role: 'user', text: 'olha', images: 2 }
    ])
  })

  it('arquivos anexados viram cartões, fora do texto', () => {
    const block = '<argus-files sizes="120,">\nAttached files (read them from disk):\n- /p/a.pdf\n- /p/b.txt\n</argus-files>'
    const list = messagesOf([user([text('lê isso'), text(block)])])
    expect(list[0]).toMatchObject({ role: 'user', text: 'lê isso', files: [{ path: '/p/a.pdf', size: 120 }, { path: '/p/b.txt' }] })
  })

  it('mensagem antiga com "Arquivos anexados:" no texto também vira cartão', () => {
    const list = messagesOf([user('resume\n\nArquivos anexados:\n- /p/a.pdf')])
    expect(list[0]).toMatchObject({ role: 'user', text: 'resume', files: [{ path: '/p/a.pdf' }] })
  })

  it('marcas do modo design vão junto do pedido', () => {
    const list = messagesOf([user([text('<argus-marca tipo="selecao">Topo › Botão</argus-marca>'), text('muda a cor')])])
    expect(list[0]).toMatchObject({ text: 'muda a cor', marks: [{ kind: 'selecao', text: 'Topo › Botão' }] })
  })
})

describe('HistoryParser: divisores', () => {
  it('troca de modelo vira divisor; a primeira resposta não', () => {
    const list = messagesOf([
      assistant([text('a')], { model: 'claude-opus-5-5' }),
      assistant([text('b')], { model: 'claude-opus-5-5' }),
      assistant([text('c')], { model: 'claude-sonnet-5-5' })
    ])
    expect(roles(list)).toEqual(['assistant', 'assistant', 'event', 'assistant'])
    expect(list[2]).toMatchObject({ kind: 'model', text: 'Modelo: Sonnet 5.5' })
  })

  it('troca já anunciada pelo /model não vira um segundo divisor', () => {
    const list = messagesOf([
      assistant([text('a')], { model: 'claude-opus-5-5' }),
      user('<local-command-stdout>Set model to claude-sonnet-5-5</local-command-stdout>'),
      assistant([text('b')], { model: 'claude-sonnet-5-5' })
    ])
    expect(list.filter((m) => m.role === 'event')).toHaveLength(1)
  })

  it('compactação, parada pelo botão e comando de barra ficam visíveis', () => {
    const list = messagesOf([
      user('<command-name>/rename</command-name>\n<command-args> meu nome </command-args>'),
      { type: 'system', subtype: 'local_command', uuid: 'out-1', content: '<local-command-stdout>Renomeado</local-command-stdout>' },
      user([text('[Request interrupted by user for tool use]')]),
      compactBoundary(80_000, 9_000)
    ])
    expect(list).toMatchObject([
      { role: 'user', text: '/rename meu nome' },
      { role: 'output', text: 'Renomeado' },
      { role: 'event', kind: 'interrupted', text: 'Você parou o Claude aqui' },
      { role: 'event', kind: 'compact', text: 'Conversa compactada automaticamente (tinha 80 mil tokens)' }
    ])
  })

  it('o "Compacted" do /compact não vira caixa: o divisor da compactação já mostra', () => {
    const list = messagesOf([
      compactBoundary(80_000, 9_000),
      user('<command-name>/compact</command-name>\n<command-args></command-args>'),
      user('<local-command-stdout>Compacted </local-command-stdout>')
    ])
    expect(roles(list)).toEqual(['event', 'user'])
  })
})

describe('HistoryParser: memória e páginas', () => {
  const chat = (n: number) => Array.from({ length: n }, (_, i) => user(`m${i}`))

  it('guarda só as últimas e avisa que há mais antes', () => {
    const parser = parse(chat(25), 5)
    const page = parser.page({ count: 3 })
    expect(texts(page.messages)).toEqual(['m22', 'm23', 'm24'])
    expect(page.more).toBe(true)
  })

  it('a página cresce a partir da mais antiga que a tela já tem, sem deslizar', () => {
    const lines = chat(10)
    const parser = parse(lines)
    const since = lines[4].uuid as string
    parser.feed(user('nova'))
    const page = parser.page({ since, count: 2 })
    expect(texts(page.messages)).toEqual(['m4', 'm5', 'm6', 'm7', 'm8', 'm9', 'nova'])
  })

  it('need e hold: com as antigas ainda na memória, segura mais; já descartadas, pede para reler', () => {
    const lines = chat(20)
    const parser = parse(lines, 5)
    // Lista cortou ao chegar no dobro (10): ficaram as 5 últimas mais as que chegaram depois.
    const kept = parser.page({ count: 1000 }).messages
    expect(kept.length).toBeLessThan(20)
    expect(parser.need({ since: kept[0].id, count: 1 })).toBe(kept.length)
    expect(parser.hold(kept.length)).toBe(true)
    expect(parser.hold(20)).toBe(false)
  })
})
