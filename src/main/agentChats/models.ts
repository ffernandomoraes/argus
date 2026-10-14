import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ClaudeInfo, ClaudeModel } from '../../shared/models'
import type { AgentRef } from '../../shared/providers'
import { tr } from '../i18n'
import { providerLaunch } from '../providers/env'
import { openCodex } from '../providers/status'
import { GEMINI_DEFAULT, openAcp, type ConfigOption } from './acp'

// Modelos de cada conta dos outros agentes, no formato que os seletores do chat já usam (o mesmo
// do Claude): o seletor de modelo e de esforço mostra o que a conta oferece. Contas de planos
// diferentes têm modelos diferentes, então é por conta. Guardado por alguns minutos.

const TTL_MS = 10 * 60_000
const cache = new Map<string, { at: number; info: Promise<ClaudeInfo | null> }>()

export function agentInfo(ref: AgentRef): Promise<ClaudeInfo | null> {
  const key = `${ref.provider}:${ref.account}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.info
  const info = (ref.provider === 'codex' ? codexInfo(ref.account) : acpInfo(ref)).catch((err: Error) => {
    console.warn(`[agentChats] modelos de ${key}:`, err.message)
    cache.delete(key)
    return null
  })
  cache.set(key, { at: Date.now(), info })
  return info
}

export function forgetAgentInfo(ref: AgentRef): void {
  cache.delete(`${ref.provider}:${ref.account}`)
}

const base = (models: ClaudeModel[]): ClaudeInfo => ({ models, defaultPermissionMode: 'manual', account: null })

type CodexModel = {
  id: string
  displayName: string
  hidden: boolean
  isDefault: boolean
  supportedReasoningEfforts: { reasoningEffort: string }[]
}

async function codexInfo(account: string): Promise<ClaudeInfo | null> {
  const launch = providerLaunch('codex', ['app-server'], account)
  if (!launch) return null
  const rpc = await openCodex(launch)
  try {
    const res = await rpc.request<{ data: CodexModel[] }>('model/list', {}, 30_000)
    const visible = res.data.filter((m) => !m.hidden)
    const def = visible.find((m) => m.isDefault) ?? visible[0]
    const efforts = (m?: CodexModel) => m?.supportedReasoningEfforts.map((e) => e.reasoningEffort) ?? []
    return base([
      { value: '', displayName: tr('Padrão', 'Default'), resolvedName: def?.displayName, efforts: efforts(def) },
      ...visible.map((m) => ({ value: m.id, displayName: m.displayName, efforts: efforts(m) }))
    ])
  } finally {
    rpc.close()
  }
}

// Gemini e Cursor só dizem os modelos de dentro de uma sessão: abre uma numa pasta temporária, lê
// e fecha.
async function acpInfo(ref: AgentRef): Promise<ClaudeInfo | null> {
  const dir = join(tmpdir(), 'argus-models')
  mkdirSync(dir, { recursive: true })
  const rpc = await openAcp(ref.provider, ref.account, dir)
  try {
    const s = await rpc.request<{
      configOptions?: ConfigOption[]
      models?: { currentModelId: string; availableModels: { modelId: string; name: string }[] }
    }>('session/new', { cwd: dir, mcpServers: [] }, 60_000)
    const option = s.configOptions?.find((o) => o.id === 'model')
    const list = option
      ? option.options.map((o) => ({ value: o.value, name: o.name }))
      : (s.models?.availableModels.map((m) => ({ value: m.modelId, name: m.name })) ?? [])
    // Gemini: o padrão do Argus não é o "auto" do CLI (ver GEMINI_DEFAULT em acp.ts).
    const fallback = ref.provider === 'gemini' ? GEMINI_DEFAULT.find((m) => list.some((x) => x.value === m)) : undefined
    const current = fallback ?? option?.currentValue ?? s.models?.currentModelId
    const currentName = list.find((m) => m.value === current)?.name
    return base([
      { value: '', displayName: tr('Padrão', 'Default'), resolvedName: currentName, efforts: [] },
      ...list.filter((m) => m.value !== current).map((m) => ({ value: m.value, displayName: m.name, efforts: [] }))
    ])
  } finally {
    rpc.close()
  }
}

// Modelo e esforço que a conta aceita. Os padrões do app vêm do Claude (um "opus" salvo): o que a
// conta não tem vira o padrão dela, em vez de erro no pedido.
export async function sanitizeSettings<T extends { model: string; effort: string }>(ref: AgentRef, s: T): Promise<T> {
  const info = await agentInfo(ref)
  const model = info?.models.find((m) => m.value === s.model && m.value !== '')
  const efforts = (model ?? info?.models.find((m) => m.value === ''))?.efforts ?? []
  return { ...s, model: model ? s.model : '', effort: efforts.includes(s.effort) ? s.effort : '' }
}
