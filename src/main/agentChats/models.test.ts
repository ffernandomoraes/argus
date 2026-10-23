import { beforeEach, describe, expect, it, vi } from 'vitest'

// Os modelos de cada conta dos outros agentes, no formato do seletor de modelo do chat. Os
// processos do Codex e do ACP são trocados por falsos que respondem a lista.

const fake = vi.hoisted(() => ({ codex: [] as unknown[], acp: {} as Record<string, unknown>, opened: 0, fail: false }))

vi.mock('../providers/env', () => ({ providerLaunch: () => ({ command: 'codex', args: [], env: {}, account: 'main' }) }))
vi.mock('../providers/status', () => ({
  openCodex: async () => {
    fake.opened++
    if (fake.fail) throw new Error('não abriu')
    return { request: async () => ({ data: fake.codex }), close: () => {} }
  }
}))
vi.mock('./acp', () => ({
  GEMINI_DEFAULT: ['gemini-3-flash-preview', 'gemini-3.5-flash'],
  openAcp: async () => ({ request: async () => fake.acp, close: () => {} })
}))

const { agentInfo, forgetAgentInfo, sanitizeSettings } = await import('./models')

const codexModel = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  displayName: id.toUpperCase(),
  hidden: false,
  isDefault: false,
  supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'high' }],
  ...extra
})

let n = 0
const ref = (provider: 'codex' | 'gemini' | 'cursor') => ({ provider, account: `conta${++n}` })

beforeEach(() => {
  fake.codex = []
  fake.acp = {}
  fake.opened = 0
  fake.fail = false
})

describe('modelos do Codex', () => {
  it('"Padrão" com o nome do modelo padrão da conta, e os escondidos ficam de fora', async () => {
    fake.codex = [codexModel('gpt-5.5'), codexModel('gpt-5.5-codex', { isDefault: true }), codexModel('interno', { hidden: true })]
    const info = await agentInfo(ref('codex'))
    expect(info?.models.map((m) => [m.value, m.displayName, m.resolvedName])).toEqual([
      ['', 'Padrão', 'GPT-5.5-CODEX'],
      ['gpt-5.5', 'GPT-5.5', undefined],
      ['gpt-5.5-codex', 'GPT-5.5-CODEX', undefined]
    ])
    expect(info?.models[0].efforts).toEqual(['low', 'high'])
  })

  it('guarda a lista por um tempo, sem abrir o Codex a cada seletor', async () => {
    fake.codex = [codexModel('gpt-5.5')]
    const r = ref('codex')
    await agentInfo(r)
    await agentInfo(r)
    expect(fake.opened).toBe(1)
    forgetAgentInfo(r)
    await agentInfo(r)
    expect(fake.opened).toBe(2)
  })

  it('falha ao abrir: sem lista, e tenta de novo na próxima vez', async () => {
    fake.fail = true
    const r = ref('codex')
    expect(await agentInfo(r)).toBeNull()
    fake.fail = false
    fake.codex = [codexModel('gpt-5.5')]
    expect((await agentInfo(r))?.models).toHaveLength(2)
  })
})

describe('modelos do Gemini e do Cursor', () => {
  it('Cursor: o modelo atual é o "Padrão" e não se repete na lista', async () => {
    fake.acp = {
      configOptions: [{ id: 'model', name: 'Model', type: 'select', currentValue: 'gpt-5', options: [{ value: 'gpt-5', name: 'GPT-5' }, { value: 'sonnet', name: 'Sonnet' }] }]
    }
    const info = await agentInfo(ref('cursor'))
    expect(info?.models.map((m) => [m.value, m.displayName, m.resolvedName])).toEqual([
      ['', 'Padrão', 'GPT-5'],
      ['sonnet', 'Sonnet', undefined]
    ])
  })

  it('Gemini: o "Padrão" é o Flash, não o "auto" do CLI', async () => {
    fake.acp = { models: { currentModelId: 'auto', availableModels: [{ modelId: 'auto', name: 'Auto' }, { modelId: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' }, { modelId: 'gemini-3-pro', name: 'Pro' }] } }
    const info = await agentInfo(ref('gemini'))
    expect(info?.models[0].resolvedName).toBe('Gemini 3.5 Flash')
    expect(info?.models.map((m) => m.value)).toEqual(['', 'auto', 'gemini-3-pro'])
  })
})

describe('sanitizeSettings', () => {
  // Os padrões do app vêm do Claude: um "opus" salvo mandado ao Codex daria erro no pedido.
  it('modelo e esforço que a conta não tem viram o padrão dela', async () => {
    fake.codex = [codexModel('gpt-5.5', { supportedReasoningEfforts: [{ reasoningEffort: 'medium' }] })]
    const r = ref('codex')
    expect(await sanitizeSettings(r, { model: 'opus', effort: 'max', permissionMode: 'default' })).toEqual({ model: '', effort: '', permissionMode: 'default' })
    expect(await sanitizeSettings(r, { model: 'gpt-5.5', effort: 'medium' })).toEqual({ model: 'gpt-5.5', effort: 'medium' })
    expect(await sanitizeSettings(r, { model: 'gpt-5.5', effort: 'high' })).toEqual({ model: 'gpt-5.5', effort: '' })
  })

  it('sem a lista de modelos, tudo vai no padrão', async () => {
    fake.fail = true
    expect(await sanitizeSettings(ref('codex'), { model: 'gpt-5.5', effort: 'high' })).toEqual({ model: '', effort: '' })
  })
})
