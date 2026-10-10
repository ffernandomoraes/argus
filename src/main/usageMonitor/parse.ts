import type { ClaudeInfo, ClaudeModel } from '../../shared/models'
import type { Usage, UsageWindow } from '../../shared/usage'

// Respostas do `claude` (stream-json) aos pedidos de controle do monitor. Lógica pura: o que vale
// de cada linha.

type RawWindow = { utilization?: number; resets_at?: string } | null | undefined

type RawModel = { value: string; displayName: string; description?: string; supportedEffortLevels?: string[] }

function toModels(raw: RawModel[]): ClaudeModel[] {
  return raw.map((m) => {
    const isDefault = m.value === 'default'
    return {
      value: isDefault ? '' : m.value,
      displayName: isDefault ? 'Padrão' : m.displayName,
      // A descrição do padrão começa com o nome do modelo atual: "Opus 5.5 · Best for...".
      resolvedName: isDefault ? m.description?.split(' · ')[0] : undefined,
      efforts: m.supportedEffortLevels ?? []
    }
  })
}

function toWindow(raw: RawWindow): UsageWindow | null {
  if (!raw || typeof raw.utilization !== 'number' || !raw.resets_at) return null
  return { percent: raw.utilization, resetsAt: raw.resets_at }
}

// info: resposta ao "init" (modelos, modo de permissão, conta). usage: resposta a um "usage-N"
// com os limites. Vazio: outra resposta de sucesso, sem nada para o app.
export type ControlReply = { info?: ClaudeInfo; usage?: Usage }

// Resposta de sucesso a um pedido de controle, ou null (outra linha, erro ou JSON quebrado).
export function parseControlReply(line: string, now: number): ControlReply | null {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return null
  }
  const res = msg?.type === 'control_response' ? msg.response : null
  if (!res || res.subtype !== 'success') return null

  if (res.request_id === 'init' && Array.isArray(res.response?.models)) {
    const mode = res.response.current_permission_mode
    return {
      info: {
        models: toModels(res.response.models),
        // Na resposta o modo manual vem como "default"; o --permission-mode chama de "manual".
        defaultPermissionMode: !mode || mode === 'default' ? 'manual' : mode,
        account: res.response.account ?? null
      }
    }
  }
  if (!String(res.request_id).startsWith('usage-')) return {}

  const limits = res.response?.rate_limits
  if (!limits) return {}
  return { usage: { session: toWindow(limits.five_hour), weekly: toWindow(limits.seven_day), updatedAt: now } }
}
