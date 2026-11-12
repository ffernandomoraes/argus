import type { Services } from '../app/services'
import { remoteAccess } from '../remote'
import { knownDistros } from '../wsl'
import type { TelemetrySnapshot } from '../../shared/telemetry'
import type { TelemetrySources } from '.'

// De onde os dados de uso leem o estado do app. Só contagens: nenhum nome, caminho ou e-mail sai daqui.
export function telemetrySources(s: Services): TelemetrySources {
  return {
    busy: () => s.chats.summary().running > 0,
    claudeCode: () => s.claudeVersion.state.current?.version ?? null,
    wsl: () => knownDistros().length > 0,
    snapshot: (): TelemetrySnapshot => {
      const b = s.boards.stats()
      const plans: Record<string, number> = {}
      const accounts = s.auth.state.accounts
      for (const a of accounts) {
        if (!a.status?.loggedIn) continue
        const plan = a.status.subscriptionType || (a.status.method && a.status.method !== 'claude.ai' ? 'api' : 'unknown')
        const key = /^[a-z0-9_-]{1,24}$/i.test(plan) ? plan.toLowerCase() : 'other'
        plans[key] = (plans[key] ?? 0) + 1
      }
      const providers = Object.entries(s.providers.state.providers)
        .filter(([, p]) => p.accounts.length > 0)
        .map(([id]) => id)
      return {
        workspaces: b.workspaces,
        folders: b.folders,
        worktrees: b.worktrees,
        groups: b.nodes.area ?? 0,
        chatCards: (b.nodes.chat ?? 0) + (b.nodes.chatPanel ?? 0),
        terminals: b.nodes.terminal ?? 0,
        notes: b.nodes.note ?? 0,
        claudeAccounts: accounts.filter((a) => a.status?.loggedIn).length,
        claudePlans: plans,
        providers,
        remoteAccess: remoteAccess().state().hosting
      }
    }
  }
}
